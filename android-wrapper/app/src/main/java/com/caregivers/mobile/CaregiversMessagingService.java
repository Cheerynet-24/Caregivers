package com.caregivers.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class CaregiversMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "caregivers_calls_messages_v2";

    @Override public void onNewToken(@NonNull String token) {
        getSharedPreferences("caregivers", MODE_PRIVATE).edit().putString("fcm_token", token).apply();
    }

    @Override public void onMessageReceived(@NonNull RemoteMessage message) {
        String title = message.getNotification() != null && message.getNotification().getTitle() != null
                ? message.getNotification().getTitle() : message.getData().getOrDefault("title", "Caregivers");
        String body = message.getNotification() != null && message.getNotification().getBody() != null
                ? message.getNotification().getBody() : message.getData().getOrDefault("body", "New notification");
        showNotification(title, body);
    }

    private void showNotification(String title, String body) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(new NotificationChannel(CHANNEL_ID, "Caregivers calls and messages", NotificationManager.IMPORTANCE_HIGH));
        Intent intent = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(this, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(com.caregivers.mobile.R.drawable.app_logo).setContentTitle(title).setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH).setDefaults(NotificationCompat.DEFAULT_ALL).setAutoCancel(true).setContentIntent(pending);
        manager.notify((int) System.currentTimeMillis(), builder.build());
    }
}
