package com.caregivers.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class CaregiversMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "caregivers_calls_messages_v2";
    public static final String REPLY_KEY = "caregivers_reply";

    @Override public void onNewToken(@NonNull String token) {
        getSharedPreferences("caregivers", MODE_PRIVATE).edit().putString("fcm_token", token).apply();
    }

    @Override public void onMessageReceived(@NonNull RemoteMessage message) {
        String type = message.getData().getOrDefault("type", "message");
        String title = value(message, "title", type.equals("call") ? "Incoming call" : "Caregivers");
        String body = value(message, "body", type.equals("call") ? "Someone is calling you" : "New message");
        showNotification(type, title, body, message.getData().getOrDefault("fromUserId", ""));
    }

    private String value(RemoteMessage message, String key, String fallback) {
        if (message.getData().containsKey(key)) return message.getData().get(key);
        if (message.getNotification() != null && key.equals("title") && message.getNotification().getTitle() != null) return message.getNotification().getTitle();
        if (message.getNotification() != null && key.equals("body") && message.getNotification().getBody() != null) return message.getNotification().getBody();
        return fallback;
    }

    private void showNotification(String type, String title, String body, String fromUserId) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(new NotificationChannel(CHANNEL_ID, "Caregivers messages and calls", NotificationManager.IMPORTANCE_HIGH));
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(this, (int) System.currentTimeMillis(), open, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        int notificationId = (int) System.currentTimeMillis();
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(com.caregivers.mobile.R.drawable.app_logo).setContentTitle(title).setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH).setDefaults(NotificationCompat.DEFAULT_ALL).setAutoCancel(true).setContentIntent(content);
        if (!type.equals("call")) {
            RemoteInput input = new RemoteInput.Builder(REPLY_KEY).setLabel("Reply").build();
            Intent reply = new Intent(this, NotificationReplyReceiver.class).putExtra("from_user_id", fromUserId).putExtra("notification_id", notificationId);
            PendingIntent replyPending = PendingIntent.getBroadcast(this, (int) System.currentTimeMillis(), reply, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0));
            builder.addAction(new NotificationCompat.Action.Builder(com.caregivers.mobile.R.drawable.app_logo, "Reply", replyPending).addRemoteInput(input).setAllowGeneratedReplies(true).setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY).build());
        }
        manager.notify(notificationId, builder.build());
    }
}
