package com.hyaadposter.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BotService")
public class BotServicePlugin extends Plugin {

    @PluginMethod
    public void startService(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, BotForegroundService.class);
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
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
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
