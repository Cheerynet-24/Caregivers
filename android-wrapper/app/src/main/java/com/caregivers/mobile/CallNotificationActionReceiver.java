package com.caregivers.mobile;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class CallNotificationActionReceiver extends BroadcastReceiver {
    public static final String ACTION_ACCEPT = "com.caregivers.mobile.CALL_ACCEPT";
    public static final String ACTION_DECLINE = "com.caregivers.mobile.CALL_DECLINE";
    public static final String ACTION_DISMISS = "com.caregivers.mobile.CALL_DISMISS";

    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        int notificationId = intent.getIntExtra("notification_id", -1);
        if (notificationId >= 0) {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.cancel(notificationId);
        }

        String action = intent.getAction();
        Intent open = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("from_user_id", intent.getStringExtra("from_user_id"))
                .putExtra("call_id", intent.getStringExtra("call_id"));

        if (ACTION_ACCEPT.equals(action)) {
            if (intent.getBooleanExtra("group_call", false)) {
                open.putExtra("incoming_group_call", true).putExtra("group_id", intent.getStringExtra("group_id"))
                        .putExtra("caller_name", intent.getStringExtra("caller_name"))
                        .putExtra("call_type", intent.getStringExtra("call_type"));
            } else {
                open.putExtra("incoming_call", true).putExtra("caller_name", intent.getStringExtra("caller_name"))
                        .putExtra("call_type", intent.getStringExtra("call_type"))
                        .putExtra("offer_b64", intent.getStringExtra("offer_b64"));
            }
        } else if (ACTION_DECLINE.equals(action)) {
            open.putExtra("incoming_call_action", "decline");
        } else if (ACTION_DISMISS.equals(action)) {
            open.putExtra("incoming_call_action", "missed");
        } else {
            return;
        }
        context.startActivity(open);
    }
}
