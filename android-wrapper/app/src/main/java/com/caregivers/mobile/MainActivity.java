package com.caregivers.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.app.DownloadManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ConsoleMessage;
import android.media.AudioManager;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends Activity {
    private static final int FILE_PICKER = 1001;
    private static final int RUNTIME_PERMISSIONS = 1002;
    private static final int NOTIFICATION_PERMISSION = 1003;
    private WebView webView;
    private ValueCallback<Uri[]> uploadCallback;
    private PermissionRequest pendingWebPermission;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;
    private AudioManager audioManager;
    private long lastBackPressedAt;
    private String pendingReplyText;
    private String pendingReplyUserId;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        readReplyIntent(getIntent());
        webView = new WebView(this);
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (audioManager != null) {
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            audioManager.setSpeakerphoneOn(false);
        }
        setContentView(webView);
        requestNotificationPermission();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setGeolocationEnabled(true);
        settings.setUseWideViewPort(false);
        settings.setLoadWithOverviewMode(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
                    String js = "javascript:(()=>{const fcm='" + token + "';let tries=0;const send=async()=>{const t=localStorage.getItem('token');if(t){try{await fetch('/api/auth/fcm-token',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({token:fcm})});}catch(e){}return;}if(++tries<30)setTimeout(send,2000);};send();})()";
                    view.evaluateJavascript(js, null);
                });
                deliverPendingReply();
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://") || url.startsWith("http://")) { view.loadUrl(url); return true; }
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) {}
                return true;
            }
        });
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType);
                request.addRequestHeader("User-Agent", userAgent);
                String cookies = android.webkit.CookieManager.getInstance().getCookie(url);
                if (cookies != null) request.addRequestHeader("Cookie", cookies);
                request.setTitle("Caregivers download");
                request.setDescription("Downloading file...");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "caregivers-" + System.currentTimeMillis());
                ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
            } catch (Exception ignored) {}
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                android.util.Log.d("CaregiversWeb", message.message() + " @" + message.lineNumber());
                return true;
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (uploadCallback != null) uploadCallback.onReceiveValue(null);
                uploadCallback = callback;
                Intent intent = params.createIntent();
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);
                try { startActivityForResult(intent, FILE_PICKER); } catch (Exception e) { uploadCallback = null; return false; }
                return true;
            }
            @Override public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean needsCamera = false;
                    boolean needsMic = false;
                    for (String resource : request.getResources()) {
                        needsCamera |= PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource);
                        needsMic |= PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource);
                    }
                    boolean cameraOk = !needsCamera || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
                    boolean micOk = !needsMic || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
                    if (cameraOk && micOk) {
                        if (needsMic && audioManager != null) audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                        request.grant(request.getResources());
                    } else {
                        if (pendingWebPermission != null) pendingWebPermission.deny();
                        pendingWebPermission = request;
                        requestRuntimePermissions();
                    }
                });
            }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) callback.invoke(origin, true, false);
                else { pendingGeoOrigin = origin; pendingGeoCallback = callback; requestRuntimePermissions(); }
            }
        });
        webView.addJavascriptInterface(new AudioRouteBridge(), "CaregiversAudio");
        webView.loadUrl(getString(com.caregivers.mobile.R.string.start_url));
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::performBackAction);
        }
    }

    private void performBackAction() {
        if (webView == null) { finish(); return; }
        webView.evaluateJavascript("window.CaregiversHandleBack ? window.CaregiversHandleBack() : false", value -> {
            if (!"true".equals(value) && !"\"true\"".equals(value)) finish();
        });
    }

    private void readReplyIntent(Intent intent) {
        if (intent == null) return;
        String text = intent.getStringExtra("notification_reply");
        String userId = intent.getStringExtra("from_user_id");
        if (text != null && userId != null) { pendingReplyText = text; pendingReplyUserId = userId; }
    }

    private void deliverPendingReply() {
        if (webView == null || pendingReplyText == null || pendingReplyUserId == null) return;
        String text = android.util.Base64.encodeToString(pendingReplyText.getBytes(java.nio.charset.StandardCharsets.UTF_8), android.util.Base64.NO_WRAP);
        String userId = android.util.Base64.encodeToString(pendingReplyUserId.getBytes(java.nio.charset.StandardCharsets.UTF_8), android.util.Base64.NO_WRAP);
        webView.evaluateJavascript("(()=>{const u=atob('" + userId + "'),t=atob('" + text + "');let n=0;const send=()=>{if(window.CaregiversNotificationReply)window.CaregiversNotificationReply(u,t);else if(++n<30)setTimeout(send,1000)};send()})()", null);
        pendingReplyText = null;
        pendingReplyUserId = null;
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readReplyIntent(intent);
        deliverPendingReply();
    }

    private class AudioRouteBridge {
        @JavascriptInterface public void setRoute(String route) {
            runOnUiThread(() -> {
                if (audioManager == null) return;
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                if ("speaker".equals(route)) {
                    audioManager.setBluetoothScoOn(false);
                    audioManager.setSpeakerphoneOn(true);
                } else if ("bluetooth".equals(route)) {
                    audioManager.setSpeakerphoneOn(false);
                    if (android.os.Build.VERSION.SDK_INT < 31) {
                        audioManager.startBluetoothSco();
                        audioManager.setBluetoothScoOn(true);
                    }
                } else {
                    audioManager.setBluetoothScoOn(false);
                    audioManager.setSpeakerphoneOn(false);
                }
            });
        }
    }

    private void requestNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION);
        }
    }

    private void requestRuntimePermissions() {
        if (android.os.Build.VERSION.SDK_INT < 23) return;
        java.util.ArrayList<String> missing = new java.util.ArrayList<>();
        if (pendingWebPermission != null) {
            for (String resource : pendingWebPermission.getResources()) {
                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) missing.add(Manifest.permission.CAMERA);
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) missing.add(Manifest.permission.RECORD_AUDIO);
            }
        }
        if (pendingGeoCallback != null && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            missing.add(Manifest.permission.ACCESS_FINE_LOCATION);
            missing.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (!missing.isEmpty()) requestPermissions(missing.toArray(new String[0]), RUNTIME_PERMISSIONS);
        else resolvePendingPermissions();
    }

    private void resolvePendingPermissions() {
        if (pendingWebPermission != null) {
            boolean cameraOk = checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
            boolean micOk = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
            java.util.ArrayList<String> allowed = new java.util.ArrayList<>();
            for (String resource : pendingWebPermission.getResources()) {
                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && cameraOk) allowed.add(resource);
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) && micOk) allowed.add(resource);
            }
            if (!allowed.isEmpty()) {
                if (allowed.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) && audioManager != null) audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                pendingWebPermission.grant(allowed.toArray(new String[0]));
            } else pendingWebPermission.deny();
            pendingWebPermission = null;
        }
        if (pendingGeoCallback != null) {
            boolean locationOk = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            pendingGeoCallback.invoke(pendingGeoOrigin, locationOk, false);
            pendingGeoCallback = null; pendingGeoOrigin = null;
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != RUNTIME_PERMISSIONS) return;
        resolvePendingPermissions();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_PICKER && uploadCallback != null) {
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            uploadCallback.onReceiveValue(results);
            uploadCallback = null;
        }
    }

    @Override protected void onDestroy() { if (webView != null) webView.destroy(); super.onDestroy(); }

    @Override public void onBackPressed() {
        performBackAction();
    }

    private void handleAppBack() {
        finish();
    }
}
