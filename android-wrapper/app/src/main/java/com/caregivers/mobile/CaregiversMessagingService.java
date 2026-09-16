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
    private static final String CHANNEL_ID = "caregivers_calls_messages_v6";
    private static final String CALL_CHANNEL_ID = "caregivers_incoming_calls_v6";
    public static final String REPLY_KEY = "caregivers_reply";

    @Override public void onNewToken(@NonNull String token) {
        getSharedPreferences("caregivers", MODE_PRIVATE).edit().putString("fcm_token", token).apply();
    }

    @Override public void onMessageReceived(@NonNull RemoteMessage message) {
        String type = message.getData().getOrDefault("type", "message");
        if (type.equals("call_cancel") || type.equals("call_end")) {
            cancelCallNotification(message.getData());
            return;
        }
        if (MainActivity.isAppVisible()) return;
        boolean isCall = type.equals("call") || type.equals("group_call");
        String callerName = message.getData().getOrDefault("callerName", "Someone");
        String title = value(message, "title", isCall ? callerName : "Caregivers");
        String body = value(message, "body", isCall ? "Incoming call" : "New message");
        showNotification(type, title, body, message.getData().getOrDefault("fromUserId", ""), message.getData());
    }

    private String value(RemoteMessage message, String key, String fallback) {
        if (message.getData().containsKey(key)) return message.getData().get(key);
        if (message.getNotification() != null && key.equals("title") && message.getNotification().getTitle() != null) return message.getNotification().getTitle();
        if (message.getNotification() != null && key.equals("body") && message.getNotification().getBody() != null) return message.getNotification().getBody();
        return fallback;
    }

    private int notificationId(String type, String fromUserId, java.util.Map<String, String> data) {
        String normalizedType = (type.equals("call_cancel") || type.equals("call_end")) ? "call" : type;
        String key = normalizedType + ":" + data.getOrDefault("callId", data.getOrDefault("groupId", fromUserId));
        int id = key.hashCode() & 0x7fffffff;
        return id == 0 ? 1 : id;
    }

    private PendingIntent callAction(String action, int notificationId, String fromUserId, java.util.Map<String, String> data) {
        Intent intent = new Intent(this, CallNotificationActionReceiver.class)
                .setAction(action)
                .putExtra("notification_id", notificationId)
                .putExtra("from_user_id", fromUserId)
                .putExtra("call_id", data.getOrDefault("callId", ""))
                .putExtra("group_id", data.getOrDefault("groupId", ""))
                .putExtra("caller_name", data.getOrDefault("callerName", "Someone"))
                .putExtra("call_type", data.getOrDefault("callType", "audio"))
                .putExtra("offer_b64", data.getOrDefault("offer", ""))
                .putExtra("group_call", data.containsKey("groupId"));
        return PendingIntent.getBroadcast(this, notificationId ^ action.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
    }

    private void showNotification(String type, String title, String body, String fromUserId, java.util.Map<String, String> data) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        boolean isCall = type.equals("call") || type.equals("group_call");
        String channelId = isCall ? CALL_CHANNEL_ID : CHANNEL_ID;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(channelId, isCall ? "Incoming Caregivers calls" : "Caregivers messages", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription(isCall ? "Incoming audio and video calls" : "New messages");
            channel.enableVibration(true);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            // Always use the phone's system defaults. Android remembers each channel's
            // sound separately, so users can configure Calls and Messages independently.
            Uri sound = defaultSound(isCall);
            AudioAttributes audio = new AudioAttributes.Builder().setUsage(isCall ? AudioAttributes.USAGE_NOTIFICATION_RINGTONE : AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
            channel.setSound(sound, audio);
            manager.createNotificationChannel(channel);
        }

        int notificationId = notificationId(type, fromUserId, data);
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (type.equals("call")) {
            open.putExtra("incoming_call", true).putExtra("from_user_id", fromUserId).putExtra("call_id", data.getOrDefault("callId", ""))
                    .putExtra("caller_name", data.getOrDefault("callerName", title)).putExtra("call_type", data.getOrDefault("callType", "audio"))
                    .putExtra("offer_b64", data.getOrDefault("offer", ""));
        } else if (type.equals("group_call")) {
            open.putExtra("incoming_group_call", true).putExtra("group_id", data.getOrDefault("groupId", ""))
                    .putExtra("from_user_id", fromUserId).putExtra("caller_name", data.getOrDefault("callerName", title))
                    .putExtra("call_type", data.getOrDefault("callType", "audio"));
        }
        PendingIntent content = type.equals("call")
                ? callAction(CallNotificationActionReceiver.ACTION_ACCEPT, notificationId, fromUserId, data)
                : PendingIntent.getActivity(this, notificationId, open, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(com.caregivers.mobile.R.drawable.app_logo).setContentTitle(title).setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX).setCategory(isCall ? NotificationCompat.CATEGORY_CALL : NotificationCompat.CATEGORY_MESSAGE)
                .setColor(android.graphics.Color.rgb(14, 165, 233)).setDefaults(NotificationCompat.DEFAULT_ALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC).setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(content);
        if (isCall) {
            builder.setOngoing(false).setTimeoutAfter(60000).setFullScreenIntent(content, true)
                    .setDeleteIntent(callAction(CallNotificationActionReceiver.ACTION_DISMISS, notificationId, fromUserId, data))
                    .addAction(new NotificationCompat.Action.Builder(com.caregivers.mobile.R.drawable.app_logo, "Join", callAction(CallNotificationActionReceiver.ACTION_ACCEPT, notificationId, fromUserId, data)).build())
                    .addAction(new NotificationCompat.Action.Builder(com.caregivers.mobile.R.drawable.app_logo, "Decline", callAction(CallNotificationActionReceiver.ACTION_DECLINE, notificationId, fromUserId, data)).build());
        } else {
            RemoteInput input = new RemoteInput.Builder(REPLY_KEY).setLabel("Reply").build();
            Intent reply = new Intent(this, NotificationReplyReceiver.class).putExtra("from_user_id", fromUserId).putExtra("notification_id", notificationId);
            PendingIntent replyPending = PendingIntent.getBroadcast(this, notificationId, reply, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0));
            builder.addAction(new NotificationCompat.Action.Builder(com.caregivers.mobile.R.drawable.app_logo, "Reply", replyPending).addRemoteInput(input).setAllowGeneratedReplies(true).setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY).build());
        }
        manager.notify(notificationId, builder.build());
    }
    private Uri defaultSound(boolean isCall) {
        return RingtoneManager.getDefaultUri(isCall ? RingtoneManager.TYPE_RINGTONE : RingtoneManager.TYPE_NOTIFICATION);
    }
    private void cancelCallNotification(java.util.Map<String, String> data) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(notificationId("call", data.getOrDefault("fromUserId", ""), data));
    }
}
