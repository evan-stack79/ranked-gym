package com.rankedgym.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * KV chiffré Android Keystore (AES-GCM). La clé n’est pas exportable ni
 * incluse dans les sauvegardes ADB/Auto Backup.
 */
@CapacitorPlugin(name = "SecureStorage")
public class SecureStoragePlugin extends Plugin {
    private static final String PREFS = "ranked_gym_secure_kv";
    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "ranked_gym_secure_kv_aes";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_BYTES = 12;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER);
        generator.init(
            new KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build()
        );
        return generator.generateKey();
    }

    private String encryptToPrefs(String plain) throws Exception {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] iv = cipher.getIV();
        byte[] cipherBytes = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
        byte[] packed = new byte[iv.length + cipherBytes.length];
        System.arraycopy(iv, 0, packed, 0, iv.length);
        System.arraycopy(cipherBytes, 0, packed, iv.length, cipherBytes.length);
        return Base64.encodeToString(packed, Base64.NO_WRAP);
    }

    private String decryptFromPrefs(String packedB64) throws Exception {
        byte[] packed = Base64.decode(packedB64, Base64.NO_WRAP);
        if (packed.length <= IV_BYTES) {
            throw new IllegalArgumentException("ciphertext trop court");
        }
        byte[] iv = new byte[IV_BYTES];
        byte[] data = new byte[packed.length - IV_BYTES];
        System.arraycopy(packed, 0, iv, 0, IV_BYTES);
        System.arraycopy(packed, IV_BYTES, data, 0, data.length);
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
        return new String(cipher.doFinal(data), StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("key required");
            return;
        }
        try {
            String packed = prefs().getString(key, null);
            JSObject ret = new JSObject();
            if (packed == null) {
                ret.put("value", JSONObject.NULL);
            } else {
                ret.put("value", decryptFromPrefs(packed));
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null || key.isEmpty() || value == null) {
            call.reject("key and value required");
            return;
        }
        try {
            prefs().edit().putString(key, encryptToPrefs(value)).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("key required");
            return;
        }
        prefs().edit().remove(key).apply();
        call.resolve();
    }
}
