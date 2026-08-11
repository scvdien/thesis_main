package online.cabarianportal.registration;

import androidx.core.content.FileProvider;

/** Shares only temporary camera images with the phone's camera app. */
public final class CameraFileProvider extends FileProvider {
    public CameraFileProvider() {
        super(R.xml.filepaths);
    }
}
