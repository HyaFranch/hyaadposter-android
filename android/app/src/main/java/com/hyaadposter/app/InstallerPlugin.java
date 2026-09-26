package com.hyaadposter.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "Installer")
public class InstallerPlugin extends Plugin {

    private static final String TAG = "InstallerPlugin";
    private static final int BUFFER_SIZE = 8192;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url      = call.getString("url");
        String fileName = call.getString("fileName", "update.apk");

        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }

        final String finalUrl      = url;
        final String finalFileName = fileName;

        new Thread(() -> {
            try {
                Context ctx = getContext();

                File outputFile = new File(ctx.getFilesDir(), finalFileName);
                if (outputFile.exists()) outputFile.delete();

                downloadFile(finalUrl, outputFile, call);

                installApk(ctx, outputFile, call);

                JSObject result = new JSObject();
                result.put("ok", true);
                call.resolve(result);

            } catch (Exception e) {
                call.reject("Download/install failed: " + e.getMessage());
            }
        }, "InstallerThread").start();
    }

    private void downloadFile(String urlStr, File outputFile, PluginCall call) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(60_000);
        conn.setInstanceFollowRedirects(true);

        int redirects = 0;
        while (redirects < 5) {
            int status = conn.getResponseCode();
            if (status == HttpURLConnection.HTTP_MOVED_TEMP
                || status == HttpURLConnection.HTTP_MOVED_PERM
                || status == 307 || status == 308) {
                String newUrl = conn.getHeaderField("Location");
                conn.disconnect();
                conn = (HttpURLConnection) new URL(newUrl).openConnection();
                conn.setConnectTimeout(15_000);
                conn.setReadTimeout(60_000);
                redirects++;
            } else {
                break;
            }
        }

        long totalBytes = conn.getContentLengthLong();
        long downloaded = 0;

        try (InputStream in = conn.getInputStream();
             OutputStream out = new FileOutputStream(outputFile)) {

            byte[] buf = new byte[BUFFER_SIZE];
            int n;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
                downloaded += n;

                if (totalBytes > 0) {
                    int progress = (int) ((downloaded * 100L) / totalBytes);
                    JSObject progressData = new JSObject();
                    progressData.put("progress", progress);
                    progressData.put("downloaded", downloaded);
                    progressData.put("total", totalBytes);
                    notifyListeners("downloadProgress", progressData);
                }
            }
        } finally {
            conn.disconnect();
        }
    }

    private void installApk(Context ctx, File apkFile, PluginCall call) {
        Uri apkUri;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {

            String authority = ctx.getPackageName() + ".fileprovider";
            apkUri = FileProvider.getUriForFile(ctx, authority, apkFile);
        } else {

            apkUri = Uri.fromFile(apkFile);
        }

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        installIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        ctx.startActivity(installIntent);
    }
}
