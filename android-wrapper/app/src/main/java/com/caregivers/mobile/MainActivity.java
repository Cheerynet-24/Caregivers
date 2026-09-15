package com.caregivers.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.ContentUris;
import android.provider.MediaStore;
import android.database.Cursor;
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
import android.media.AudioDeviceInfo;
import android.media.MediaPlayer;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.graphics.drawable.Icon;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends Activity {
    private static volatile boolean appVisible;
    private static final int FILE_PICKER = 1001;
    private static final int RUNTIME_PERMISSIONS = 1002;
    private static final int NOTIFICATION_PERMISSION = 1003;
    private static final int MEDIA_PERMISSION = 1004;
    private WebView webView;
    private ValueCallback<Uri[]> uploadCallback;
    private PermissionRequest pendingWebPermission;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;
    private AudioManager audioManager;
    private long lastBackPressedAt;
    private String pendingReplyText;
    private String pendingReplyUserId;
    private String pendingCallFromUserId;
    private String pendingCallUsername;
    private String pendingCallType;
    private String pendingCallOffer;
    private String pendingCallAction;
    private String pendingCallId;
    private MediaSession musicSession;
    private NotificationManager musicNotificationManager;
    private String musicTitle = "Caregivers Music";
    private String musicArtist = "Phone Music";
    private boolean musicPlaying;
    private MediaPlayer nativeMusicPlayer;
    private static final String MUSIC_CHANNEL = "caregivers_music";
    private static final String MUSIC_PLAY = "com.caregivers.mobile.MUSIC_PLAY";
    private static final String MUSIC_PREVIOUS = "com.caregivers.mobile.MUSIC_PREVIOUS";
    private static final String MUSIC_NEXT = "com.caregivers.mobile.MUSIC_NEXT";
    private static final String MUSIC_STOP = "com.caregivers.mobile.MUSIC_STOP";

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        readReplyIntent(getIntent());
        readIncomingCallIntent(getIntent());
        readIncomingCallAction(getIntent());
        webView = new WebView(this);
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        setupMusicSession();
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
                requestMediaPermissionIfNeeded();
                FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
                    String js = "javascript:(()=>{const fcm='" + token + "';let tries=0;const send=async()=>{const t=localStorage.getItem('token');if(t){try{await fetch('/api/auth/fcm-token',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({token:fcm})});}catch(e){}return;}if(++tries<30)setTimeout(send,2000);};send();})()";
                    view.evaluateJavascript(js, null);
                });
                deliverPendingReply();
                deliverIncomingCall();
                deliverIncomingCallAction();
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
        webView.addJavascriptInterface(new AppExitBridge(), "CaregiversApp");
        webView.addJavascriptInterface(new LocalMusicBridge(), "CaregiversLocalMusic");
        webView.addJavascriptInterface(new MusicNotificationBridge(), "CaregiversMusic");
        webView.loadUrl(getString(com.caregivers.mobile.R.string.start_url));
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::performBackAction);
        }
    }

    public static boolean isAppVisible() { return appVisible; }

    @Override protected void onResume() {
        super.onResume();
        appVisible = true;
    }

    @Override protected void onPause() {
        appVisible = false;
        super.onPause();
    }

    private void setupMusicSession() {
        musicNotificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (android.os.Build.VERSION.SDK_INT >= 26) musicNotificationManager.createNotificationChannel(new NotificationChannel(MUSIC_CHANNEL, "Music Player", NotificationManager.IMPORTANCE_LOW));
        musicSession = new MediaSession(this, "CaregiversMusic");
        musicSession.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { sendMusicCommand("play"); }
            @Override public void onPause() { sendMusicCommand("pause"); }
            @Override public void onSkipToNext() { sendMusicCommand("next"); }
            @Override public void onSkipToPrevious() { sendMusicCommand("previous"); }
            @Override public void onStop() { sendMusicCommand("stop"); }
        });
        musicSession.setActive(true);
    }

    private PendingIntent musicAction(String action, int requestCode) {
        Intent intent = new Intent(this, MainActivity.class).setAction(action);
        return PendingIntent.getActivity(this, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void sendMusicCommand(String command) {
        if (webView != null) webView.evaluateJavascript("window.CaregiversMusicCommand && window.CaregiversMusicCommand('" + command + "')", null);
    }

    private void playNativeMusic(String url, String title, String artist) {
        runOnUiThread(() -> {
            android.content.res.AssetFileDescriptor descriptor = null;
            try {
                if (nativeMusicPlayer != null) nativeMusicPlayer.release();
                nativeMusicPlayer = new MediaPlayer();
                nativeMusicPlayer.setAudioAttributes(new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_MEDIA).setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC).build());
                descriptor = getContentResolver().openAssetFileDescriptor(Uri.parse(url), "r");
                if (descriptor == null) throw new IllegalStateException("Cannot open audio file");
                nativeMusicPlayer.setDataSource(descriptor.getFileDescriptor(), descriptor.getStartOffset(), descriptor.getLength());
                updateMusicNotification(title, artist, false);
                final android.content.res.AssetFileDescriptor finalDescriptor = descriptor;
                nativeMusicPlayer.setOnPreparedListener(player -> { try { finalDescriptor.close(); } catch (Exception ignored) {} player.start(); updateMusicNotification(title, artist, true); });
                nativeMusicPlayer.setOnCompletionListener(player -> sendMusicCommand("next"));
                nativeMusicPlayer.setOnErrorListener((player, what, extra) -> { stopMusicNotification(); showMusicError("Audio ဖွင့်မရပါ (" + what + ")"); return true; });
                nativeMusicPlayer.prepareAsync();
            } catch (Exception error) { try { if (descriptor != null) descriptor.close(); } catch (Exception ignored) {} stopMusicNotification(); showMusicError("ဒီဖိုင်ကို ဖွင့်မရပါ"); }
        });
    }

    private void showMusicError(String message) { if (webView != null) webView.evaluateJavascript("window.CaregiversMusicError && window.CaregiversMusicError(" + quoteForJs(message) + ")", null); }

    private void pauseNativeMusic() { if (nativeMusicPlayer != null && nativeMusicPlayer.isPlaying()) { nativeMusicPlayer.pause(); updateMusicNotification(musicTitle, musicArtist, false); } }
    private void resumeNativeMusic() { if (nativeMusicPlayer != null && !nativeMusicPlayer.isPlaying()) { nativeMusicPlayer.start(); updateMusicNotification(musicTitle, musicArtist, true); } }
    private void stopNativeMusic() { if (nativeMusicPlayer != null) { nativeMusicPlayer.stop(); nativeMusicPlayer.release(); nativeMusicPlayer = null; } stopMusicNotification(); }

    private void handleMusicIntent(Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        if (MUSIC_PLAY.equals(intent.getAction())) sendMusicCommand(musicPlaying ? "pause" : "play");
        else if (MUSIC_PREVIOUS.equals(intent.getAction())) sendMusicCommand("previous");
        else if (MUSIC_NEXT.equals(intent.getAction())) sendMusicCommand("next");
        else if (MUSIC_STOP.equals(intent.getAction())) sendMusicCommand("stop");
    }

    private void updateMusicNotification(String title, String artist, boolean playing) {
        musicTitle = title == null || title.isEmpty() ? "Caregivers Music" : title;
        musicArtist = artist == null || artist.isEmpty() ? "Phone Music" : artist;
        musicPlaying = playing;
        if (musicSession == null || musicNotificationManager == null) return;
        musicSession.setMetadata(new android.media.MediaMetadata.Builder().putString(android.media.MediaMetadata.METADATA_KEY_TITLE, musicTitle).putString(android.media.MediaMetadata.METADATA_KEY_ARTIST, musicArtist).build());
        musicSession.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_STOP).setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f).build());
        Notification.Builder builder = android.os.Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, MUSIC_CHANNEL) : new Notification.Builder(this);
        builder.setSmallIcon(com.caregivers.mobile.R.drawable.app_logo).setContentTitle(musicTitle).setContentText(musicArtist).setOngoing(playing).setVisibility(Notification.VISIBILITY_PUBLIC).setContentIntent(musicAction(MUSIC_PLAY, 10));
        builder.addAction(new Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_previous), "Previous", musicAction(MUSIC_PREVIOUS, 11)).build());
        builder.addAction(new Notification.Action.Builder(Icon.createWithResource(this, playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play), playing ? "Pause" : "Play", musicAction(MUSIC_PLAY, 10)).build());
        builder.addAction(new Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_next), "Next", musicAction(MUSIC_NEXT, 12)).build());
        builder.addAction(new Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_menu_close_clear_cancel), "Stop", musicAction(MUSIC_STOP, 13)).build());
        if (android.os.Build.VERSION.SDK_INT >= 21) builder.setStyle(new Notification.MediaStyle().setMediaSession(musicSession.getSessionToken()).setShowActionsInCompactView(0, 1, 2));
        musicNotificationManager.notify(741, builder.build());
    }

    private void stopMusicNotification() {
        musicPlaying = false;
        if (musicNotificationManager != null) musicNotificationManager.cancel(741);
    }

    private void performBackAction() {
        if (webView == null) { finish(); return; }
        final boolean[] callbackReturned = {false};
        webView.evaluateJavascript("window.CaregiversHandleBack ? window.CaregiversHandleBack() : false", value -> {
            callbackReturned[0] = true;
            if (!"true".equals(value) && !"\"true\"".equals(value)) finish();
        });
        new android.os.Handler(getMainLooper()).postDelayed(() -> { if (!callbackReturned[0]) finish(); }, 300);
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

    private void readIncomingCallIntent(Intent intent) {
        if (intent == null || !intent.getBooleanExtra("incoming_call", false)) return;
        pendingCallFromUserId = intent.getStringExtra("from_user_id");
        pendingCallUsername = intent.getStringExtra("caller_name");
        pendingCallType = intent.getStringExtra("call_type");
        pendingCallOffer = intent.getStringExtra("offer_b64");
        pendingCallId = intent.getStringExtra("call_id");
        pendingCallAction = null;
    }

    private void readIncomingCallAction(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra("incoming_call_action");
        if (action == null || action.isEmpty()) return;
        pendingCallFromUserId = intent.getStringExtra("from_user_id");
        pendingCallId = intent.getStringExtra("call_id");
        pendingCallAction = action;
    }

    private void deliverIncomingCall() {
        if (webView == null || pendingCallFromUserId == null || pendingCallOffer == null || pendingCallOffer.isEmpty()) return;
        String from = encodeJs(pendingCallFromUserId);
        String name = encodeJs(pendingCallUsername == null ? "Someone" : pendingCallUsername);
        String type = encodeJs(pendingCallType == null ? "audio" : pendingCallType);
        String callId = encodeJs(pendingCallId == null ? "" : pendingCallId);
        String script = "(()=>{const d=s=>atob('" + from + "');const u=d('" + from + "');const n=atob('" + name + "');const t=atob('" + type + "');const c=atob('" + callId + "');let tries=0;const send=()=>{if(window.CaregiversIncomingCall)window.CaregiversIncomingCall(u,n,t," + quoteForJs(pendingCallOffer) + ",c);else if(++tries<30)setTimeout(send,500)};send()})()";
        webView.evaluateJavascript(script, null);
        pendingCallFromUserId = null; pendingCallUsername = null; pendingCallType = null; pendingCallOffer = null; pendingCallId = null;
    }

    private void deliverIncomingCallAction() {
        if (webView == null || pendingCallAction == null || pendingCallFromUserId == null) return;
        String action = encodeJs(pendingCallAction);
        String from = encodeJs(pendingCallFromUserId);
        String callId = encodeJs(pendingCallId == null ? "" : pendingCallId);
        String script = "(()=>{const d=s=>atob(s);let n=0;const send=()=>{if(window.CaregiversIncomingCallAction)window.CaregiversIncomingCallAction(d('" + action + "'),d('" + from + "'),d('" + callId + "'));else if(++n<30)setTimeout(send,500)};send()})()";
        webView.evaluateJavascript(script, null);
        pendingCallAction = null;
        pendingCallFromUserId = null;
        pendingCallId = null;
    }

    private String encodeJs(String value) {
        return android.util.Base64.encodeToString(value.getBytes(java.nio.charset.StandardCharsets.UTF_8), android.util.Base64.NO_WRAP);
    }

    private String quoteForJs(String value) {
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleMusicIntent(intent);
        readReplyIntent(intent);
        readIncomingCallIntent(intent);
        readIncomingCallAction(intent);
        deliverPendingReply();
        deliverIncomingCall();
        deliverIncomingCallAction();
    }

    private class AudioRouteBridge {
        @JavascriptInterface public void setRoute(String route) {
            runOnUiThread(() -> {
                if (audioManager == null) return;
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                if (android.os.Build.VERSION.SDK_INT >= 31) {
                    int wanted = "speaker".equals(route) ? AudioDeviceInfo.TYPE_BUILTIN_SPEAKER : "bluetooth".equals(route) ? AudioDeviceInfo.TYPE_BLUETOOTH_SCO : AudioDeviceInfo.TYPE_BUILTIN_EARPIECE;
                    for (AudioDeviceInfo device : audioManager.getAvailableCommunicationDevices()) {
                        if (device.getType() == wanted) { audioManager.setCommunicationDevice(device); return; }
                    }
                }
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

    private class AppExitBridge {
        @JavascriptInterface public void exit() { runOnUiThread(() -> finish()); }
    }

    private class LocalMusicBridge {
        @JavascriptInterface public void refresh() { runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript("window.CaregiversLocalMusicReady && window.CaregiversLocalMusicReady()", null); }); }
        @JavascriptInterface public String listSongs() {
            if (!hasMediaPermission()) return "[]";
            org.json.JSONArray songs = new org.json.JSONArray();
            String[] projection = { MediaStore.Audio.Media._ID, MediaStore.Audio.Media.TITLE, MediaStore.Audio.Media.ARTIST, MediaStore.Audio.Media.DURATION };
            Uri audioUri = android.os.Build.VERSION.SDK_INT >= 29 ? MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL) : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            try (Cursor cursor = getContentResolver().query(audioUri, projection, null, null, MediaStore.Audio.Media.TITLE + " COLLATE NOCASE ASC")) {
                if (cursor == null) return "[]";
                int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                int artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                int durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                while (cursor.moveToNext()) {
                    org.json.JSONObject song = new org.json.JSONObject();
                    long id = cursor.getLong(idCol);
                    song.put("id", "native-" + id);
                    song.put("title", cursor.getString(titleCol));
                    song.put("artist", cursor.getString(artistCol));
                    song.put("duration", cursor.getLong(durationCol));
                    song.put("url", ContentUris.withAppendedId(audioUri, id).toString());
                    songs.put(song);
                }
            } catch (Exception ignored) {}
            return songs.toString();
        }
        @JavascriptInterface public void requestPermission() {
            runOnUiThread(() -> {
                if (android.os.Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{Manifest.permission.READ_MEDIA_AUDIO}, MEDIA_PERMISSION);
                else if (android.os.Build.VERSION.SDK_INT >= 23) requestPermissions(new String[]{Manifest.permission.READ_EXTERNAL_STORAGE}, MEDIA_PERMISSION);
            });
        }
        private boolean hasMediaPermission() {
            if (android.os.Build.VERSION.SDK_INT >= 33) return checkSelfPermission(Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED;
            return android.os.Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        }
    }

    private class MusicNotificationBridge {
        @JavascriptInterface public void playLocal(String url, String title, String artist) { playNativeMusic(url, title, artist); }
        @JavascriptInterface public void pause() { runOnUiThread(() -> pauseNativeMusic()); }
        @JavascriptInterface public void resume() { runOnUiThread(() -> resumeNativeMusic()); }
        @JavascriptInterface public void stop() { runOnUiThread(() -> stopNativeMusic()); }
        @JavascriptInterface public void update(String title, String artist, boolean playing) { runOnUiThread(() -> updateMusicNotification(title, artist, playing)); }
        @JavascriptInterface public void clear() { runOnUiThread(() -> stopMusicNotification()); }
    }

    private void requestNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION);
        }
    }

    private void requestMediaPermissionIfNeeded() {
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.READ_MEDIA_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.READ_MEDIA_AUDIO}, MEDIA_PERMISSION);
        } else if (android.os.Build.VERSION.SDK_INT >= 23 && android.os.Build.VERSION.SDK_INT < 33 && checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.READ_EXTERNAL_STORAGE}, MEDIA_PERMISSION);
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
        if (requestCode == MEDIA_PERMISSION) {
            if (webView != null) webView.evaluateJavascript("window.CaregiversLocalMusicReady && window.CaregiversLocalMusicReady()", null);
            requestNotificationPermission();
            return;
        }
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
