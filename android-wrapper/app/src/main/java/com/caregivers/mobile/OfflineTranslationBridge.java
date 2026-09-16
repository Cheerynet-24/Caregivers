package com.caregivers.mobile;

import android.webkit.JavascriptInterface;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.nl.languageid.LanguageIdentification;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;
import org.json.JSONObject;

public class OfflineTranslationBridge {
    private final MainActivity activity;
    public OfflineTranslationBridge(MainActivity activity) { this.activity = activity; }

    @JavascriptInterface
    public void translate(String requestId, String text) {
        final String safeText = text == null ? "" : text.trim();
        if (safeText.isEmpty()) returnResult(requestId, "", "Text is empty");
        LanguageIdentification.getClient().identifyLanguage(safeText)
                .addOnSuccessListener(language -> {
                    String source = "und".equals(language) ? TranslateLanguage.ENGLISH : language;
                    if (TranslateLanguage.MYANMAR.equals(source)) returnResult(requestId, safeText, "");
                    else translateWithModel(requestId, safeText, source);
                })
                .addOnFailureListener(error -> returnResult(requestId, "", "Language detection failed"));
    }

    private void translateWithModel(String requestId, String text, String source) {
        String sourceLanguage = TranslateLanguage.fromLanguageTag(source);
        if (sourceLanguage == null) sourceLanguage = TranslateLanguage.ENGLISH;
        TranslatorOptions options = new TranslatorOptions.Builder()
                .setSourceLanguage(sourceLanguage)
                .setTargetLanguage(TranslateLanguage.MYANMAR)
                .build();
        Translator translator = Translation.getClient(options);
        translator.downloadModelIfNeeded(new DownloadConditions.Builder().build())
                .addOnSuccessListener(ignored -> translator.translate(text)
                        .addOnSuccessListener(result -> { returnResult(requestId, result, ""); translator.close(); })
                        .addOnFailureListener(error -> { returnResult(requestId, "", "Offline translation failed"); translator.close(); }))
                .addOnFailureListener(error -> { returnResult(requestId, "", "Myanmar translation model download failed. Connect once to the internet, then try again."); translator.close(); });
    }

    private void returnResult(String requestId, String result, String error) {
        activity.runOnUiThread(() -> {
            try {
                String js = "window.CaregiversOfflineTranslationResult(" + JSONObject.quote(requestId) + "," + JSONObject.quote(result) + "," + JSONObject.quote(error) + ")";
                activity.evaluateJavascript(js);
            } catch (Exception ignored) {}
        });
    }
}
EOF
