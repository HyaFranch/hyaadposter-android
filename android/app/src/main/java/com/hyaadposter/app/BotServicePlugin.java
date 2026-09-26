package com.hyaadposter.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BotService")
public class BotServicePlugin extends Plugin {

    // Referência estática pra permitir que o BotForegroundService (rodando
    // fora do ciclo de vida normal do plugin) emita eventos "botLog" e
    // "botStatus" pro JS, mesmo com a WebView em segundo plano — o app
    // ainda ouve, o listener só não é chamado se não houver instância viva
    // (ex.: app foi realmente fechado, não só minimizado).
    private static BotServicePlugin instance;
    // Guarda o último status conhecido pra quando o app é reaberto com o
    // service já rodando em background — sem isso a UI voltaria mostrando
    // "idle" mesmo com o bot ativo, até o próximo evento chegar.
    private static volatile String lastStatus = "idle";

    @Override
    public void load() {
        instance = this;
    }

    public static void emitLog(String level, String text) {
        if (instance == null) return;
        JSObject data = new JSObject();
        data.put("level", level);
        data.put("text", text);
        instance.notifyListeners("botLog", data);
    }

    public static void emitStatus(String status) {
        lastStatus = status;
        if (instance == null) return;
        JSObject data = new JSObject();
        data.put("status", status);
        instance.notifyListeners("botStatus", data);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject r = new JSObject();
        r.put("status", lastStatus);
        call.resolve(r);
    }

    @PluginMethod
    public void startService(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, BotForegroundService.class);
        // call.getData() já é um JSObject (subclasse de JSONObject), então
        // o .toString() gera um JSON válido com username/cookie/queue/etc,
        // que o service lê pra rodar o loop de postagem nativamente.
        intent.putExtra("payload", call.getData().toString());
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(ctx, intent);
            } else {
                ctx.startService(intent);
            }
            JSObject r = new JSObject(); r.put("started", true); call.resolve(r);
        } catch (Exception e) { call.reject("Failed: " + e.getMessage()); }
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        getContext().stopService(new Intent(getContext(), BotForegroundService.class));
        JSObject r = new JSObject(); r.put("stopped", true); call.resolve(r);
    }

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        boolean ignoring = false;
        if (pm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            ignoring = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        JSObject r = new JSObject(); r.put("ignoring", ignoring); call.resolve(r);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Context ctx = getContext();
        String pkg = ctx.getPackageName();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent(
                    android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + pkg)
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
                call.resolve(new JSObject()); return;
            } catch (Exception ignored) {}
        }

        if (isMiui()) {
            if (tryMiuiBatteryIntent(ctx, pkg)) {
                call.resolve(new JSObject()); return;
            }
        }

        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + pkg));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        } catch (Exception ignored) {}
        call.resolve(new JSObject());
    }

    private boolean isMiui() {
        String manufacturer = Build.MANUFACTURER.toLowerCase();
        return manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco")
            || !getSystemProperty("ro.miui.ui.version.name").isEmpty();
    }

    private boolean tryMiuiBatteryIntent(Context ctx, String pkg) {

        String[][] attempts = {

            { "com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity" },

            { "com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity" },

            { "com.miui.securitycenter", "com.miui.powercenter.PowerSettings" },
        };
        for (String[] e : attempts) {
            try {
                Intent i = new Intent();
                i.setClassName(e[0], e[1]);
                i.putExtra("extra_pkgname", pkg);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
                return true;
            } catch (Exception ignored) {}
        }

        try {
            Intent i = new Intent("miui.intent.action.APP_PERM_EDITOR");
            i.setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity");
            i.putExtra("extra_pkgname", pkg);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            return true;
        } catch (Exception ignored) {}
        return false;
    }

    private String getSystemProperty(String key) {
        try {
            Class<?> c = Class.forName("android.os.SystemProperties");
            java.lang.reflect.Method m = c.getMethod("get", String.class, String.class);
            return (String) m.invoke(null, key, "");
        } catch (Exception e) { return ""; }
    }
}
