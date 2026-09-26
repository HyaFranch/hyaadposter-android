package com.hyaadposter.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Roda o loop de postagem de trade ads inteiramente em Java, sem depender
 * da WebView estar visível. Antes, esse service só mostrava a notificação
 * e segurava um wakelock enquanto o loop de verdade rodava em JS dentro da
 * WebView — que o Chromium congela quando o app vai pra segundo plano.
 * Agora o loop e as chamadas HTTP (Rolimons + webhook) rodam aqui direto.
 */
public class BotForegroundService extends Service {
    public static final String CHANNEL_ID = "hyaadposter_bot";
    public static final int NOTIF_ID = 1001;

    private static final String COOKIE_NAME = "_RoliVerification";
    private static final String UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

    private PowerManager.WakeLock wakeLock;
    private Thread loopThread;
    private volatile boolean running = false;

    @Override
    public void onCreate() {
        super.onCreate();
        acquireWakeLock();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();
        showNotification("Bot ativo — postando trade ads");

        if (!running && intent != null) {
            String payload = intent.getStringExtra("payload");
            if (payload != null) startLoop(payload);
        }
        return START_STICKY;
    }

    private void showNotification(String text) {
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openApp, pendingFlags);
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("HyaAdPoster")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setOngoing(true).setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
        NotificationManager mgr = getSystemService(NotificationManager.class);
        if (mgr != null) mgr.notify(NOTIF_ID, notification);
        startForeground(NOTIF_ID, notification);
    }

    // ---------------------------------------------------------------- loop

    private void startLoop(String payloadJson) {
        running = true;
        loopThread = new Thread(() -> runLoop(payloadJson), "HyaAdPoster-BotLoop");
        loopThread.setDaemon(true);
        loopThread.start();
    }

    private void runLoop(String payloadJson) {
        try {
            JSONObject payload = new JSONObject(payloadJson);
            String username     = payload.optString("username", "");
            String cookie       = payload.optString("cookie", "");
            String profileName  = payload.optString("profileName", "");
            String webhookUrl   = payload.isNull("webhookUrl") ? null : payload.optString("webhookUrl", null);
            long postIntervalMs = payload.optLong("postIntervalMs", 15 * 60 * 1000L);
            JSONArray queue     = payload.optJSONArray("queue");

            if (queue == null || queue.length() == 0) {
                emitLog("error", "Profile has no trades in its queue.");
                emitStatus("idle");
                stopSelfSafely();
                return;
            }

            emitStatus("running");

            int userId;
            String resolvedName;
            String avatarUrl;
            try {
                JSONObject user = resolveUserId(username);
                userId = user.getInt("id");
                resolvedName = user.getString("name");
                emitLog("ok", "Connected as " + resolvedName + " (id " + userId + ")");
                avatarUrl = getUserAvatarUrl(userId);
            } catch (Exception e) {
                emitLog("error", "Could not resolve user: " + e.getMessage());
                emitStatus("idle");
                stopSelfSafely();
                return;
            }

            int index = 0;
            int adsPosted = 0;

            while (running) {
                JSONObject trade = queue.getJSONObject(index % queue.length());
                JSONArray offerItems  = trade.optJSONArray("offer_items");
                JSONArray tags        = trade.optJSONArray("tags");
                JSONArray requestIds  = trade.optJSONArray("request_item_ids");

                JSONArray offerIds = new JSONArray();
                List<String> names = new ArrayList<>();
                int itemCount = offerItems != null ? offerItems.length() : 0;
                for (int i = 0; i < itemCount; i++) {
                    JSONObject item = offerItems.getJSONObject(i);
                    offerIds.put(item.opt("assetId"));
                    names.add(item.optString("name", ""));
                }
                String namesStr = String.join(", ", names);

                try {
                    JSONObject result = postAd(userId, cookie, offerIds,
                            tags != null ? tags : new JSONArray(),
                            requestIds != null ? requestIds : new JSONArray());
                    boolean ok = result.optBoolean("ok", false);
                    String message = result.optString("message", "");

                    if (ok) {
                        adsPosted++;
                        emitLog("ok", message + " (" + namesStr + ")");
                        if (hasWebhook(webhookUrl)) {
                            notifySuccess(webhookUrl, username, avatarUrl, userId, profileName,
                                    offerItems, tags, adsPosted, postIntervalMs);
                        }
                    } else {
                        emitLog("warn", message + " (" + namesStr + ")");
                        if (hasWebhook(webhookUrl)) {
                            notifyWarning(webhookUrl, username, avatarUrl, userId, profileName, message, namesStr);
                        }
                    }
                } catch (CookieExpiredException ce) {
                    emitLog("error", "Cookie expired or invalid — re-verify the account.");
                    if (hasWebhook(webhookUrl)) {
                        notifyWarning(webhookUrl, username, avatarUrl, userId, profileName,
                                "Cookie expired. Re-verify the account.", "—");
                    }
                    emitStatus("expired");
                    stopSelfSafely();
                    return;
                } catch (Exception e) {
                    emitLog("error", "Cycle error: " + e.getMessage());
                }

                index++;
                if (!running) break;

                emitLog("info", "Waiting " + (postIntervalMs / 60000) + " minutes before next ad…");
                if (!sleepInterruptible(postIntervalMs)) break;
            }
        } catch (Exception e) {
            emitLog("error", "Fatal bot error: " + e.getMessage());
        } finally {
            emitLog("info", "Bot stopped.");
            emitStatus("idle");
            running = false;
        }
    }

    private boolean hasWebhook(String url) {
        return url != null && !url.isEmpty();
    }

    private boolean sleepInterruptible(long ms) {
        long slept = 0;
        long step = 1000;
        while (slept < ms) {
            if (!running) return false;
            try {
                Thread.sleep(Math.min(step, ms - slept));
            } catch (InterruptedException e) {
                return false;
            }
            slept += step;
        }
        return true;
    }

    private static class CookieExpiredException extends Exception {
        CookieExpiredException(String msg) { super(msg); }
    }

    // ------------------------------------------------------------- Rolimons

    private JSONObject resolveUserId(String username) throws Exception {
        JSONObject body = new JSONObject();
        JSONArray usernames = new JSONArray();
        usernames.put(username);
        body.put("usernames", usernames);
        body.put("excludeBannedUsers", true);

        HttpResult res = httpRaw("POST", "https://users.roblox.com/v1/usernames/users", null, body.toString());
        if (res.status != 200) throw new Exception("HTTP " + res.status);
        JSONObject parsed = new JSONObject(res.body);
        JSONArray data = parsed.optJSONArray("data");
        if (data == null || data.length() == 0) throw new Exception("User '" + username + "' not found");
        JSONObject first = data.getJSONObject(0);
        JSONObject out = new JSONObject();
        out.put("id", first.getInt("id"));
        out.put("name", first.getString("name"));
        return out;
    }

    private String getUserAvatarUrl(int userId) {
        try {
            HttpResult res = httpRaw("GET",
                "https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=" + userId
                    + "&size=150x150&format=Png&isCircular=false",
                null, null);
            JSONObject parsed = new JSONObject(res.body);
            JSONArray data = parsed.optJSONArray("data");
            if (data != null && data.length() > 0) return data.getJSONObject(0).optString("imageUrl", "");
        } catch (Exception ignored) {}
        return "";
    }

    private JSONObject postAd(int userId, String cookie, JSONArray offerItemIds, JSONArray tags,
                               JSONArray requestItemIds) throws Exception {
        JSONObject body = new JSONObject();
        body.put("player_id", userId);
        body.put("offer_item_ids", offerItemIds);
        body.put("request_item_ids", requestItemIds);
        body.put("request_tags", tags);

        Map<String, String> headers = new HashMap<>();
        headers.put("Cookie", COOKIE_NAME + "=" + cookie);

        HttpResult res;
        try {
            res = httpRaw("POST", "https://api.rolimons.com/tradeads/v1/createad", headers, body.toString());
        } catch (Exception e) {
            JSONObject out = new JSONObject();
            out.put("ok", false);
            out.put("message", "Connection error: " + e.getMessage());
            return out;
        }

        if (res.status == 401 || res.status == 403) throw new CookieExpiredException("HTTP " + res.status);

        JSONObject parsed;
        try { parsed = new JSONObject(res.body); } catch (Exception e) { parsed = new JSONObject(); }
        String msg = parsed.optString("message", "");

        JSONObject out = new JSONObject();
        if (msg.toLowerCase(Locale.ROOT).matches(".*(not verified|not authenticated|invalid session|log in).*")) {
            throw new CookieExpiredException(msg);
        }
        if ("Ad creation cooldown has not elapsed".equals(msg)) {
            out.put("ok", false);
            out.put("message", "Cooldown has not elapsed yet");
            return out;
        }
        if (res.status != 201) {
            String snippet = res.body.length() > 200 ? res.body.substring(0, 200) : res.body;
            out.put("ok", false);
            out.put("message", "HTTP " + res.status + ": " + snippet);
            return out;
        }
        out.put("ok", true);
        out.put("message", "Ad posted successfully");
        return out;
    }

    // -------------------------------------------------------------- webhook

    private void notifySuccess(String webhookUrl, String username, String avatarUrl, int userId,
                                String profileName, JSONArray offerItems, JSONArray tags,
                                int adsPosted, long postIntervalMs) {
        try {
            List<String> lines = new ArrayList<>();
            double totalRap = 0, totalVal = 0;
            int n = offerItems != null ? offerItems.length() : 0;
            for (int i = 0; i < Math.min(n, 10); i++) {
                JSONObject item = offerItems.getJSONObject(i);
                String name = item.optString("name", "");
                int qty = item.optInt("quantity", 1);
                double rap = item.optDouble("rap", 0);
                double val = item.optDouble("value", -1);
                String qtyStr = qty > 1 ? " x" + qty : "";
                String valStr = val > 0 ? fmt(val) : "N/A";
                lines.add("• **" + name + "**" + qtyStr + " — RAP " + fmt(rap) + " · Value " + valStr);
            }
            if (n > 10) lines.add("_…and " + (n - 10) + " more_");
            for (int i = 0; i < n; i++) {
                JSONObject item = offerItems.getJSONObject(i);
                totalRap += item.optDouble("rap", 0);
                double val = item.optDouble("value", -1);
                if (val > 0) totalVal += val;
            }
            List<String> tagLabels = new ArrayList<>();
            if (tags != null) for (int i = 0; i < tags.length(); i++) tagLabels.add(tags.optString(i));
            String tagLabel = tagLabels.isEmpty() ? "—" : String.join(", ", tagLabels);

            JSONObject embed = new JSONObject();
            embed.put("title", "🔄 New trade ad posted");
            embed.put("color", 0x3FC98A);
            embed.put("author", author(username, userId, avatarUrl));
            JSONArray fields = new JSONArray();
            fields.put(field("Profile", profileName.isEmpty() ? "—" : profileName, true));
            fields.put(field("Tags", tagLabel, true));
            fields.put(field("Offered items (" + n + ")", lines.isEmpty() ? "—" : String.join("\n", lines), false));
            fields.put(field("Total RAP", fmt(totalRap), true));
            fields.put(field("Total Value", fmt(totalVal), true));
            embed.put("fields", fields);
            JSONObject footer = new JSONObject();
            footer.put("text", "HyaAdPoster · ad #" + adsPosted + " this session · next in "
                    + (postIntervalMs / 60000) + " min");
            embed.put("footer", footer);
            embed.put("timestamp", Instant.now().toString());

            sendWebhook(webhookUrl, embed);
        } catch (Exception ignored) {}
    }

    private void notifyWarning(String webhookUrl, String username, String avatarUrl, int userId,
                                String profileName, String message, String names) {
        try {
            JSONObject embed = new JSONObject();
            embed.put("title", "⚠️ Failed to post ad");
            embed.put("color", 0xE5566D);
            embed.put("author", author(username, userId, avatarUrl));
            JSONArray fields = new JSONArray();
            fields.put(field("Profile", profileName.isEmpty() ? "—" : profileName, true));
            fields.put(field("Reason", message.length() > 1000 ? message.substring(0, 1000) : message, false));
            fields.put(field("Items", names.length() > 1000 ? names.substring(0, 1000) : names, false));
            embed.put("fields", fields);
            JSONObject footer = new JSONObject();
            footer.put("text", "HyaAdPoster");
            embed.put("footer", footer);
            embed.put("timestamp", Instant.now().toString());

            sendWebhook(webhookUrl, embed);
        } catch (Exception ignored) {}
    }

    private JSONObject author(String username, int userId, String avatarUrl) throws Exception {
        JSONObject author = new JSONObject();
        author.put("name", username);
        author.put("url", "https://www.rolimons.com/player/" + userId);
        if (avatarUrl != null && !avatarUrl.isEmpty()) author.put("icon_url", avatarUrl);
        return author;
    }

    private JSONObject field(String name, String value, boolean inline) throws Exception {
        JSONObject f = new JSONObject();
        f.put("name", name);
        f.put("value", value);
        f.put("inline", inline);
        return f;
    }

    private void sendWebhook(String webhookUrl, JSONObject embed) {
        try {
            JSONObject body = new JSONObject();
            JSONArray embeds = new JSONArray();
            embeds.put(embed);
            body.put("embeds", embeds);
            httpRaw("POST", webhookUrl, null, body.toString());
        } catch (Exception ignored) {}
    }

    private String fmt(double n) {
        return String.format(Locale.forLanguageTag("pt-BR"), "%,.0f", Math.round(n));
    }

    // ------------------------------------------------------------------ http

    private static class HttpResult {
        int status;
        String body;
    }

    private HttpResult httpRaw(String method, String urlStr, Map<String, String> extraHeaders, String body)
            throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(20000);
        conn.setRequestProperty("User-Agent", UA);
        conn.setRequestProperty("Content-Type", "application/json");
        if (extraHeaders != null) {
            for (Map.Entry<String, String> e : extraHeaders.entrySet()) {
                conn.setRequestProperty(e.getKey(), e.getValue());
            }
        }
        if (body != null) {
            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }
        int status = conn.getResponseCode();
        InputStream is = (status >= 200 && status < 400) ? conn.getInputStream() : conn.getErrorStream();
        String respBody = is != null ? readStream(is) : "";
        conn.disconnect();

        HttpResult r = new HttpResult();
        r.status = status;
        r.body = respBody;
        return r;
    }

    private String readStream(InputStream is) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }

    // -------------------------------------------------------------- events

    private void emitLog(String level, String text) {
        BotServicePlugin.emitLog(level, text);
    }

    private void emitStatus(String status) {
        BotServicePlugin.emitStatus(status);
    }

    private void stopSelfSafely() {
        running = false;
        stopSelf();
    }

    // ----------------------------------------------------------- lifecycle

    @Override
    public void onDestroy() {
        running = false;
        if (loopThread != null) loopThread.interrupt();
        releaseWakeLock();
        stopForeground(true);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null && (wakeLock == null || !wakeLock.isHeld())) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HyaAdPoster:BotWakeLock");
            wakeLock.acquire();
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Bot Status", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Mantém o HyaAdPoster ativo em segundo plano");
            ch.setShowBadge(false);
            NotificationManager mgr = getSystemService(NotificationManager.class);
            if (mgr != null) mgr.createNotificationChannel(ch);
        }
    }
}
