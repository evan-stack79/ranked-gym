package com.rankedgym.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SecureStoragePlugin.class);
        registerPlugin(CameraHeartRatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
