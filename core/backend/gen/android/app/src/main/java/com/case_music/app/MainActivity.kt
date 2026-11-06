package com.case_music.app

import android.os.Bundle
import android.content.Intent
import androidx.core.content.ContextCompat
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    ContextCompat.startForegroundService(this, Intent(this, PlaybackService::class.java))
  }

  override fun onDestroy() {
    stopService(Intent(this, PlaybackService::class.java))
    super.onDestroy()
  }
}
