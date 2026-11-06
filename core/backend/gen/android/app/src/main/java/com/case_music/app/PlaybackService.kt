package com.case_music.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder

/** Keeps the WebView process eligible for media playback while the screen is off. */
class PlaybackService : Service() {
  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel("playback", "Music playback", NotificationManager.IMPORTANCE_LOW)
    )
    val notification = Notification.Builder(this, "playback")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(getString(R.string.app_name))
      .setContentText("Music playback is available")
      .setOngoing(true)
      .build()
    startForeground(1, notification)
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
