package com.caregivers.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class CaregiversMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "caregivers_calls_messages_v4";
    private static final String CALL_CHANNEL_ID = "caregivers_incoming_calls_v4";
    public static final String REPLY_KEY = "caregivers_reply";

    @Override public void onNewToken(@NonNull String token) {
        getSharedPreferences("caregivers", MODE_PRIVATE).edit().putString("fcm_token", token).apply();
    }

    @Override public void onMessageReceived(@NonNull RemoteMessage message) {
        String type = message.getData().getOrDefault("type", "message");
        if (MainActivity.isAppVisible()) return;
        String callerName = message.getData().getOrDefault("callerName", "Someone");
        String title = value(message, "title", type.equals("call") ? callerName : "Caregivers");
        String body = value(message, "body", type.equals("call") ? "Incoming call" : "New message");
        showNotification(type, title, body, message.getData().getOrDefault("fromUserId", ""), message.getData());
    }

    private String value(RemoteMessage message, String key, String fallback) {
        if (message.getData().containsKey(key)) return message.getData().get(key);
        if (message.getNotification() != null && key.equals("title") && message.getNotification().getTitle() != null) return message.getNotification().getTitle();
        if (message.getNotification() != null && key.equals("body") && message.getNotification().getBody() != null) return message.getNotification().getBody();
        return fallback;
    }

    private int notificationId(String type, String fromUserId, java.util.Map<String, String> data) {
        String key = type + ":" + data.getOrDefault("callId", fromUserId);
        int id = key.hashCode() & 0x7fffffff;
        return id == 0 ? 1 : id;
    }

    private PendingIntent callAction(String action, int notificationId, String fromUserId, java.util.Map<String, String> data) {
        Intent intent = new Intent(this, CallNotificationActionReceiver.class)
                .setAction(action)
                .putExtra("notification_id", notificationId)
                .putExtra("from_user_id", fromUserId)
                .putExtra("call_id", data.getOrDefault("callId", ""))
                .putExtra("caller_name", data.getOrDefault("callerName", "Someone"))
                .putExtra("call_type", data.getOrDefault("callType", "audio"))
                .putExtra("offer_b64", data.getOrDefault("offer", ""));
        return PendingIntent.getBroadcast(this, notificationId ^ action.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
    }

    private void showNotification(String type, String title, String body, String fromUserId, java.util.Map<String, String> data) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        String channelId = type.equals("call") ? CALL_CHANNEL_ID : CHANNEL_ID;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(channelId, type.equals("call") ? "Incoming Caregivers calls" : "Caregivers messages", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription(type.equals("call") ? "Incoming audio and video calls" : "New messages");
            channel.enableVibration(true);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            Uri sound = RingtoneManager.getDefaultUri(type.equals("call") ? RingtoneManager.TYPE_RINGTONE : RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audio = new AudioAttributes.Builder().setUsage(type.equals("call") ? AudioAttributes.USAGE_NOTIFICATION_RINGTONE : AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
            channel.setSound(sound, audio);
            manager.createNotificationChannel(channel);
        }

        int notificationId = notificationId(type, fromUserId, data);
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (type.equals("call")) {
            open.putExtra("incoming_call", true);
            open.putExtra("from_user_id", fromUserId);
            open.putExtra("call_id", data.getOrDefault("callId", ""));
            open.putExtra("caller_name", data.getOrDefault("callerName", title));
            open.putExtra("call_type", data.getOrDefault("callType", "audio"));
            open.putExtra("offer_b64", data.getOrDefault("offer", ""));
        }
        PendingIntent content = type.equals("call")
                ? callAction(CallNotificationActionReceiver.ACTION_ACCEPT, notificationId, fromUserId, data)
                : PendingIntent.getActivity(this, notificationId, open, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(com.caregivers.mobile.R.drawable.app_logo).setContentTitle(title).setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX).setCategory(type.equals("call") ? NotificationCompat.CATEGORY_CALL : NotificationCompat.CATEGORY_MESSAGE)
                .setColor(android.graphics.Color.rgb(14, 165, 233)).setDefaults(NotificationCompat.DEFAULT_ALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(content);
        if (type.equals("call")) {
            builder.setOngoing(false).setTimeoutAfter(60000).setFullScreenIntent(content, true)
                    .setDeleteIntent(callAction(CallNotificationActionReceiver.ACTION_DISMISS, notificationId, fromUserId, data))
                    .addAction(new NotificationCompat.Action.Builder(com.caregivers.mobile.R.drawable.app_logo, "Accept", callAction(CallNotificationActionReceiver.ACTION_ACCEPT, notificationId, fromUserId, data)).build())
                    .addAction(new NotificationCompat.Action.Builder(com.caregivers.mobile.R.drawable.app_logo, "Decline", callAction(CallNotificationActionReceiver.ACTION_DECLINE, notificationId, fromUserId, data)).build());
        } else {
            RemoteInput input = new RemoteInput.Builder(REPLY_KEY).setLabel("Reply").build();
            Intent reply = new Intent(this, NotificationReplyReceiver.class).putExtra("from_user_id", fromUserId).putExtra("notification_id", notificationId);
            PendingIntent replyPending = PendingIntent.getBroadcast(this, notificationId, reply, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0));
            builder.addAction(new NotificationCompat.Action.Builder(com.caregivers.mobile.R.drawable.app_logo, "Reply", replyPending).addRemoteInput(input).setAllowGeneratedReplies(true).setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY).build());
        }
        manager.notify(notificationId, builder.build());
    }
}
