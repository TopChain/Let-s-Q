package app.letsq.queue;

import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.coordinatorlayout.widget.CoordinatorLayout;

/**
 * First-party Let’s Q promotion used only when a paid AdMob placement is not
 * available. This is intentionally local UI: no tracking, no ad request, and
 * no dependency on Google ad delivery.
 */
public final class LetsQHouseAds {
    private static final long FULL_PAGE_AUTO_CLOSE_MS = 5000L;
    private static final long BANNER_ROTATION_MS = 8000L;

    private static final String[][] BANNER_MESSAGES = {
        {"Private queues. No account required.", "Join with a QR or short code and keep personal details private."},
        {"Wait anywhere, not in line.", "Keep your place and check live queue status from your phone."},
        {"Hosts can launch a queue in minutes.", "Create, share, call next, and manage no-shows from one app."},
        {"One app for Hosts and Queuers.", "Simple queueing without names, phone numbers, or email addresses."}
    };

    private final Activity activity;
    private final ViewGroup parent;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private View bannerView;
    private TextView bannerTitle;
    private TextView bannerBody;
    private Dialog fullPageDialog;
    private int bannerMessageIndex = 0;

    private final Runnable rotateBanner = new Runnable() {
        @Override
        public void run() {
            if (bannerView == null || bannerTitle == null || bannerBody == null) return;
            applyNextBannerMessage();
            handler.postDelayed(this, BANNER_ROTATION_MS);
        }
    };

    public LetsQHouseAds(Activity activity, ViewGroup parent) {
        this.activity = activity;
        this.parent = parent;
    }

    public int showBanner() {
        if (activity.isFinishing() || activity.isDestroyed()) return 0;
        hideBanner();

        int height = dp(72);
        LinearLayout card = new LinearLayout(activity);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(18), dp(10), dp(18), dp(10));
        card.setBackground(roundedBackground(Color.rgb(241, 247, 255), 0));
        card.setContentDescription("Let’s Q tip");

        TextView title = new TextView(activity);
        title.setTextColor(Color.rgb(16, 37, 66));
        title.setTextSize(15);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setMaxLines(1);

        TextView body = new TextView(activity);
        body.setTextColor(Color.rgb(74, 91, 117));
        body.setTextSize(12);
        body.setMaxLines(1);

        card.addView(title, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        card.addView(body, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        CoordinatorLayout.LayoutParams params = new CoordinatorLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            height
        );
        params.gravity = Gravity.BOTTOM;
        parent.addView(card, params);
        card.bringToFront();

        bannerView = card;
        bannerTitle = title;
        bannerBody = body;
        applyNextBannerMessage();
        handler.postDelayed(rotateBanner, BANNER_ROTATION_MS);
        return height;
    }

    public void hideBanner() {
        handler.removeCallbacks(rotateBanner);
        if (bannerView != null) {
            ViewGroup owner = (ViewGroup) bannerView.getParent();
            if (owner != null) owner.removeView(bannerView);
        }
        bannerView = null;
        bannerTitle = null;
        bannerBody = null;
    }

    public void showFullPage(String kicker, String titleText, String bodyText, Runnable finished) {
        if (activity.isFinishing() || activity.isDestroyed()) {
            if (finished != null) finished.run();
            return;
        }

        dismissFullPage(false);
        Dialog dialog = new Dialog(activity);
        dialog.setCancelable(true);
        dialog.setCanceledOnTouchOutside(false);

        LinearLayout panel = new LinearLayout(activity);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER_HORIZONTAL);
        panel.setPadding(dp(28), dp(40), dp(28), dp(28));
        panel.setBackgroundColor(Color.WHITE);

        TextView brand = new TextView(activity);
        brand.setText(kicker == null || kicker.isEmpty() ? "LET’S Q" : kicker);
        brand.setTextColor(Color.rgb(0, 104, 224));
        brand.setTextSize(13);
        brand.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        brand.setLetterSpacing(0.08f);
        panel.addView(brand);

        TextView title = new TextView(activity);
        title.setText(titleText);
        title.setTextColor(Color.rgb(15, 31, 55));
        title.setTextSize(28);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        titleParams.topMargin = dp(28);
        panel.addView(title, titleParams);

        TextView body = new TextView(activity);
        body.setText(bodyText);
        body.setTextColor(Color.rgb(73, 90, 114));
        body.setTextSize(17);
        body.setGravity(Gravity.CENTER);
        body.setLineSpacing(0, 1.18f);
        LinearLayout.LayoutParams bodyParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        bodyParams.topMargin = dp(18);
        panel.addView(body, bodyParams);

        TextView benefits = new TextView(activity);
        benefits.setText("QR or short code  •  Live status  •  Private by design");
        benefits.setTextColor(Color.rgb(0, 104, 224));
        benefits.setTextSize(14);
        benefits.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        benefits.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams benefitParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        benefitParams.topMargin = dp(28);
        panel.addView(benefits, benefitParams);

        Button continueButton = new Button(activity);
        continueButton.setText("Continue");
        continueButton.setTextSize(16);
        continueButton.setTextColor(Color.WHITE);
        continueButton.setAllCaps(false);
        continueButton.setBackground(roundedBackground(Color.rgb(0, 120, 255), dp(18)));
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(52)
        );
        buttonParams.topMargin = dp(36);
        panel.addView(continueButton, buttonParams);

        dialog.setContentView(panel);
        Window window = dialog.getWindow();
        if (window != null) {
            window.setBackgroundDrawableResource(android.R.color.transparent);
            window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.dimAmount = 0.45f;
            window.setAttributes(attributes);
        }

        final boolean[] completed = { false };
        Runnable completeOnce = () -> {
            if (completed[0]) return;
            completed[0] = true;
            handler.removeCallbacksAndMessages(dialog);
            if (dialog.isShowing()) dialog.dismiss();
            if (fullPageDialog == dialog) fullPageDialog = null;
            if (finished != null) finished.run();
        };

        continueButton.setOnClickListener(v -> completeOnce.run());
        dialog.setOnCancelListener(d -> completeOnce.run());
        dialog.setOnDismissListener(d -> {
            if (!completed[0]) completeOnce.run();
        });

        fullPageDialog = dialog;
        dialog.show();
        if (window != null) {
            window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        }
        handler.postAtTime(completeOnce, dialog, android.os.SystemClock.uptimeMillis() + FULL_PAGE_AUTO_CLOSE_MS);
    }

    public void destroy() {
        hideBanner();
        dismissFullPage(false);
        handler.removeCallbacksAndMessages(null);
    }

    private void applyNextBannerMessage() {
        if (bannerTitle == null || bannerBody == null) return;
        String[] message = BANNER_MESSAGES[bannerMessageIndex % BANNER_MESSAGES.length];
        bannerMessageIndex++;
        bannerTitle.setText(message[0]);
        bannerBody.setText(message[1]);
    }

    private void dismissFullPage(boolean runDismissListener) {
        if (fullPageDialog == null) return;
        Dialog dialog = fullPageDialog;
        fullPageDialog = null;
        if (!runDismissListener) dialog.setOnDismissListener(null);
        if (dialog.isShowing()) dialog.dismiss();
    }

    private GradientDrawable roundedBackground(int color, int radiusPx) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radiusPx);
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * activity.getResources().getDisplayMetrics().density);
    }
}
