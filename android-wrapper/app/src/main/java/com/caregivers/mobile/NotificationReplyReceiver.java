package com.caregivers.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.RemoteInput;

public class NotificationReplyReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        CharSequence reply = null;
        android.os.Bundle results = RemoteInput.getResultsFromIntent(intent);
        if (results != null) reply = results.getCharSequence(CaregiversMessagingService.REPLY_KEY);
        int notificationId = intent.getIntExtra("notification_id", -1);
        if (notificationId >= 0) ((android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(notificationId);
        if (reply == null || reply.toString().trim().isEmpty()) return;
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra("notification_reply", reply == null ? "" : reply.toString());
        open.putExtra("from_user_id", intent.getStringExtra("from_user_id"));
        context.startActivity(open);
    }
}
