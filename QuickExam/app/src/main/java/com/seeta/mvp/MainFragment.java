package com.seeta.mvp;

import android.Manifest;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.PorterDuff;
import android.graphics.Rect;
import android.hardware.Camera;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.WorkerThread;
import androidx.core.app.ActivityCompat;
import androidx.fragment.app.Fragment;

import com.example.quickexam.MainApplication;
import com.example.quickexam.activity.FragmentActivity;
import com.seeta.sdk.SeetaImageData;
import com.example.quickexam.R;
import com.seeta.camera.CameraCallbacks;
import com.seeta.camera.CameraPreview2;

import org.opencv.core.Mat;

import butterknife.BindView;
import butterknife.ButterKnife;

import static com.example.quickexam.MainApplication.m_iMenuTask;

@SuppressWarnings("deprecation")
public class MainFragment extends Fragment
        implements VerificationContract.View {

    public static final String TAG = "MainFragment";

    private static final int REQUEST_CAMERA_PERMISSION = 200;

    @BindView(R.id.camera_preview)
    CameraPreview2 mCameraPreview;

    @BindView(R.id.surfaceViewOverlap)
    protected SurfaceView mOverlap;

    @BindView(R.id.txt_name)
    TextView txtTips;

    @BindView(R.id.et_registername)
    EditText edit_name;
    @BindView(R.id.et_registerid)
    EditText edit_id;
    @BindView(R.id.et_registerage)
    EditText edit_age;
    @BindView(R.id.et_registersex)
    EditText edit_sex;
    @BindView(R.id.et_registerheight)
    EditText edit_height;
    @BindView(R.id.et_registerweight)
    EditText edit_weight;

    @BindView(R.id.btn_register)
    Button btn_register;

    @BindView(R.id.btn_ok)
    Button btn_ok;

    // Show compared score and start tip. Add by linhx 20170428 end
    private VerificationContract.Presenter mPresenter;
    private AlertDialog mCameraUnavailableDialog;
    private Camera.Size mPreviewSize;

    private SurfaceHolder mOverlapHolder;
    private Rect focusRect = new Rect();
    private Paint mFaceRectPaint = null;
    private Paint mFaceNamePaint = null;

    private float mPreviewScaleX = 1.0f;
    private float mPreviewScaleY = 1.0f;

    private int mCurrentStatus = 0;
    private Mat mImageAfterBlink = null;
    private org.opencv.core.Rect mFaceRectAfterBlink = null;

    public boolean needFaceRegister = false;//是否需要注册人脸
    public String registeredName = "";//注册的名称

    public SeetaImageData imageData = new SeetaImageData(480, 640, 3);

    private CameraCallbacks mCameraCallbacks = new CameraCallbacks() {
        @Override
        public void onCameraUnavailable(int errorCode) {
            Log.e(TAG, "camera unavailable, reason=%d" + errorCode);
            showCameraUnavailableDialog(errorCode);
        }

        @Override
        public void onPreviewFrame(byte[] data, Camera camera) {
            if (mPreviewSize == null) {
                mPreviewSize = camera.getParameters().getPreviewSize();

                mPreviewScaleX = (float) (mCameraPreview.getHeight()) / mPreviewSize.width;
                mPreviewScaleY = (float) (mCameraPreview.getWidth()) / mPreviewSize.height;
            }

            mPresenter.detect(data, mPreviewSize.width, mPreviewSize.height,
                    mCameraPreview.getCameraRotation());
        }
    };
    private FragmentActivity activity;


    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.i(TAG, "onCreate");
        mFaceRectPaint = new Paint();
        mFaceRectPaint.setColor(Color.argb(150, 0, 255, 0));
        mFaceRectPaint.setStrokeWidth(3);
        mFaceRectPaint.setStyle(Paint.Style.STROKE);

        mFaceNamePaint = new Paint();
        mFaceNamePaint.setColor(Color.argb(150, 0, 255, 0));
        mFaceNamePaint.setTextSize(50);
        mFaceNamePaint.setStyle(Paint.Style.FILL);

    }

    @Nullable
    @Override
    public View onCreateView(LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        Log.i(TAG, "onCreateView");
        return inflater.inflate(R.layout.fragment_main, container, false);
    }

    @Override
    public void onViewCreated(View view, @Nullable Bundle savedInstanceState) {
        Log.i(TAG, "onViewCreated");
        super.onViewCreated(view, savedInstanceState);
        ButterKnife.bind(this, view);
        mOverlap.setZOrderOnTop(true);
        mOverlap.getHolder().setFormat(PixelFormat.TRANSLUCENT);
        mOverlapHolder = mOverlap.getHolder();

        mCameraPreview.setCameraCallbacks(mCameraCallbacks);
        activity = (FragmentActivity) getActivity();

//        setStatus(0, null, null);

        btn_register.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                //人脸注册
                needFaceRegister = true;
//                if (activity.feats == null &&activity.feats.length == 0){
//                    MainApplication.miflytts.playText("请对准摄像头录入人脸");
//                    Toast.makeText(getActivity(), "请对准摄像头录入人脸", Toast.LENGTH_SHORT).show();
//                    return;
//                }
//                if (edit_name.getText().toString() == null && edit_name.getText().toString().length() == 0) {
//                    MainApplication.miflytts.playText("请输入姓名");
//                    Toast.makeText(getActivity(), "请输入姓名", Toast.LENGTH_SHORT).show();
//                    return;
//                }
                change();
            }
        });
        btn_ok.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                m_iMenuTask = 1;
                //Application app = (Application)activity.getApplication();
                if (activity.changeBP) {
                    change();
                } else {
                    Intent intent = new Intent();
                    if (!activity.recognizedName.isEmpty())
                        intent.putExtra("name", activity.recognizedName);
                    activity.setResult(2000, intent);
                    activity.finish();
                }
            }
        });
        edit_name.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                edit_name.setFocusable(true);
            }
        });
    }

    @Override
    public void onHiddenChanged(boolean hidden) {
        super.onHiddenChanged(hidden);
        if (!hidden){
            mCameraPreview.setCameraCallbacks(mCameraCallbacks);
        }
    }

    private void change() {
        registeredName = edit_name.getText().toString();
        activity.recognizedName = edit_name.getText().toString();
        activity.id = edit_id.getText().toString();
        activity.age = edit_age.getText().toString();
        activity.sex = edit_sex.getText().toString();
        activity.height = edit_height.getText().toString();
        activity.weight = edit_weight.getText().toString();
        activity = (FragmentActivity) getActivity();
        activity.changeBlood();
        mCameraPreview.setCameraCallbacks(null);
    }

    @WorkerThread
    @Override
    public void drawFaceRect(org.opencv.core.Rect faceRect) {
        if (!isActive()) {
            return;
        }
        Canvas canvas = mOverlapHolder.lockCanvas();
        if (canvas == null) {
            return;
        }
        canvas.drawColor(0, PorterDuff.Mode.CLEAR);

        if (faceRect != null) {
            faceRect.x *= mPreviewScaleX;
            faceRect.y *= mPreviewScaleY;
            faceRect.width *= mPreviewScaleX;
            faceRect.height *= mPreviewScaleY;

            focusRect.left = faceRect.x;
            focusRect.right = faceRect.x + faceRect.width;
            focusRect.top = faceRect.y;
            focusRect.bottom = faceRect.y + faceRect.height;

            canvas.drawRect(focusRect, mFaceRectPaint);
        }
        mOverlapHolder.unlockCanvasAndPost(canvas);
    }

    @WorkerThread
    @Override
    public void drawFaceImage(Bitmap faceBmp) {
        if (!isActive()) {
            return;
        }
        Canvas canvas = mOverlapHolder.lockCanvas();
        if (canvas == null) {
            return;
        }
        canvas.drawColor(0, PorterDuff.Mode.CLEAR);
        if (faceBmp != null && !faceBmp.isRecycled()) {
            canvas.drawBitmap(faceBmp, 0, 0, mFaceRectPaint);
        }

        mOverlapHolder.unlockCanvasAndPost(canvas);
    }

    @Override
    public void toastMessage(String msg) {
        if (!TextUtils.isEmpty(msg)) {

        }
    }

    @Override
    public void showCameraUnavailableDialog(int errorCode) {
        if (mCameraUnavailableDialog == null) {
            mCameraUnavailableDialog = new AlertDialog.Builder(getActivity())
                    .setTitle("摄像头不可用")
                    .setMessage(getContext().getString(R.string.please_restart_device_or_app, errorCode))
                    .setPositiveButton("重试", new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            getActivity().runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    getActivity().recreate();
                                }
                            });
                        }
                    })
                    .setNegativeButton("退出", new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            getActivity().runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    getActivity().finish();
                                }
                            });
                        }
                    })
                    .create();
        }
        if (!mCameraUnavailableDialog.isShowing()) {
            mCameraUnavailableDialog.show();
        }
    }

    @Override
    public void setStatus(int status, Mat matBgr, org.opencv.core.Rect faceRect) {
        Log.i(TAG, "setStatus " + status);

    }

    @Override
    public void setName(String name, Mat matBgr, org.opencv.core.Rect faceRect, String id, boolean isChangeBP) {
        //展示名称
        if (!isActive()) {
            return;
        }
        Canvas canvas = mOverlapHolder.lockCanvas();
        activity.recognizedName = name;
        //canvas.drawText(recognizedName, 100, 100, mFaceNamePaint);
        if (canvas == null) {
            return;
        }
        mOverlapHolder.unlockCanvasAndPost(canvas);
        activity.changeBP = isChangeBP;
        activity._id = id;

        //显示识别结果
        //txtTips.setText(name);
        edit_name.setText(name);
    }

    @Override
    public void showSimpleTip(String tip) {
        needFaceRegister = false;
        registeredName = "";
        Toast.makeText(getContext(), tip, Toast.LENGTH_LONG).show();
    }

    @Override
    public void FaceRegister(String tip, float[] feats) {

        needFaceRegister = false;
        registeredName = "";
        activity.feats = feats;
//        txtTips.setText(tip);
        //提示注册成功
        Toast.makeText(getContext(), tip, Toast.LENGTH_LONG).show();
        //还原EditView
        edit_name.setText("");
        edit_name.setHint("enter name");
        //edit_name.setFocusable(false);
    }

    @Override
    public void setBestImage(Bitmap bitmap) {

    }

    @Override
    public void setPresenter(VerificationContract.Presenter presenter) {
        this.mPresenter = presenter;
    }

    @Override
    public boolean isActive() {
        return getView() != null && isAdded() && !isDetached();
    }

    @Override
    public TextureView getTextureView() {
        return mCameraPreview;
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
    }

    @SuppressWarnings("unused")
    private void requestCameraPermission() {
        ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.CAMERA},
                REQUEST_CAMERA_PERMISSION);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        if (requestCode == REQUEST_CAMERA_PERMISSION) {
            getActivity().recreate();
        }
    }

}
