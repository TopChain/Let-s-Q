package app.letsq.queue;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.ump.UserMessagingPlatform;

/** Exposes the Google-required privacy choices form to the web interface. */
@CapacitorPlugin(name = "AdMobPrivacy")
public class AdMobPrivacyPlugin extends Plugin {
    @com.getcapacitor.PluginMethod
    public void showPrivacyChoices(PluginCall call) {
        getActivity().runOnUiThread(() ->
            UserMessagingPlatform.showPrivacyOptionsForm(getActivity(), formError -> call.resolve())
        );
    }
}
