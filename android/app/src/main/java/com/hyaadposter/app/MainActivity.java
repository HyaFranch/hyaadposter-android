package com.hyaadposter.app;

import com.getcapacitor.BridgeActivity;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(BotServicePlugin.class);
        registerPlugin(InstallerPlugin.class);
        registerPlugin(CookieCapturePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        super.onPause();

        WebView wv = getBridge().getWebView();
        if (wv != null) {
            wv.resumeTimers();
            wv.onResume();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
    }

    @Override
    public void onStop() {
        super.onStop();

        WebView wv = getBridge().getWebView();
        if (wv != null) {
            wv.resumeTimers();
        }
    }

    @Override
    public void onStart() {
        super.onStart();
    }
}
