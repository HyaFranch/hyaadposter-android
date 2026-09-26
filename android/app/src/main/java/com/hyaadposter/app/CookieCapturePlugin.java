package com.hyaadposter.app;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CookieCapture")
public class CookieCapturePlugin extends Plugin {

    private static final String TARGET_URL  = "https://www.rolimons.com/verify";
    private static final String COOKIE_HOST = "https://www.rolimons.com";
    private static final String COOKIE_NAME = "_RoliVerification";
    private static final long   POLL_MS     = 800;

    @PluginMethod
    public void openLoginWindow(PluginCall call) {

        call.setKeepAlive(true);
        Context ctx = getActivity();
        new Handler(Looper.getMainLooper()).post(() -> showDialog(ctx, call));
    }

    private void showDialog(Context ctx, PluginCall call) {
        Dialog dialog = new Dialog(ctx, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        FrameLayout root = new FrameLayout(ctx);

        ProgressBar pb = new ProgressBar(ctx, null,
                android.R.attr.progressBarStyleHorizontal);
        FrameLayout.LayoutParams pbParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 6);
        pb.setLayoutParams(pbParams);
        pb.setMax(100);
        pb.setVisibility(android.view.View.GONE);

        WebView wv = new WebView(ctx);
        wv.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings ws = wv.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setSupportZoom(false);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);

        ws.setUserAgentString(
                "Mozilla/5.0 (Linux; Android 12; Pixel 6) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/124.0.0.0 Mobile Safari/537.36");

        CookieManager.getInstance().removeAllCookies(null);
        CookieManager.getInstance().flush();
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true);

        Handler pollHandler = new Handler(Looper.getMainLooper());
        Runnable[] pollRef = new Runnable[1];

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                pb.setVisibility(android.view.View.VISIBLE);
                pb.setProgress(20);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pb.setProgress(90);
                pb.setVisibility(android.view.View.GONE);

                startPolling(pollHandler, pollRef, dialog, call);
            }
        });

        root.addView(wv);
        root.addView(pb);
        dialog.setContentView(root);

        dialog.setOnCancelListener(d -> {
            pollHandler.removeCallbacks(pollRef[0]);
            JSObject r = new JSObject();
            r.put("ok", false);
            r.put("cookie", "");
            call.resolve(r);
            call.setKeepAlive(false);
        });

        dialog.show();
        wv.loadUrl(TARGET_URL);
    }

    private void startPolling(Handler h, Runnable[] ref, Dialog dialog, PluginCall call) {

        if (ref[0] != null) return;

        ref[0] = new Runnable() {
            @Override
            public void run() {
                String cookies = CookieManager.getInstance().getCookie(COOKIE_HOST);
                if (cookies != null && cookies.contains(COOKIE_NAME + "=")) {
                    String value = extractValue(cookies, COOKIE_NAME);
                    if (!value.isEmpty()) {
                        dialog.dismiss();
                        JSObject r = new JSObject();
                        r.put("ok", true);
                        r.put("cookie", value);
                        call.resolve(r);
                        call.setKeepAlive(false);
                        return;
                    }
                }
                h.postDelayed(this, POLL_MS);
            }
        };
        h.postDelayed(ref[0], POLL_MS);
    }

    private String extractValue(String allCookies, String name) {
        for (String part : allCookies.split(";")) {
            String s = part.trim();
            if (s.startsWith(name + "=")) {
                return s.substring(name.length() + 1).trim();
            }
        }
        return "";
    }
}
