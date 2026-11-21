package fr.nautic.test;

import android.content.SharedPreferences;
import android.graphics.*;
import android.net.Uri;
import android.view.*;
import android.widget.*;
import androidx.media3.common.*;
import androidx.media3.exoplayer.*;
import androidx.media3.exoplayer.rtsp.RtspMediaSource;
import org.json.*;
import java.util.*;

/** Muted local RTSP previews, bounded to visible dashboard tiles. Duplicate URLs share a decoder. */
final class DashboardCameras {
 final MainActivity activity;final FrameLayout layer;
 final SharedPreferences settings;
 final CameraCrop[] crops={CameraCrop.CENTER,CameraCrop.CENTER,CameraCrop.CENTER,CameraCrop.CENTER};
 int dp(float n){return (int)(n*activity.getResources().getDisplayMetrics().density+.5f);}
 int lastCenterReset=-1;
 int draggingCamera;
 final Map<String,Tile> tiles=new LinkedHashMap<>();
 final Map<String,Source> sources=new LinkedHashMap<>();
 final Map<String,Long> retryAt=new HashMap<>();
 int decoderBudget=4;
 float mapAlpha=1,uiOpacity=.60f;
 TextView qualityButton,medallionButton,axisButton;
 private final DashboardRecording recording;
 private TextView captureButton;
 private FrameLayout playback;
 private ExoPlayer playbackPlayer;
 private Source captureAuxiliary;
 private Runnable captureWait;


 boolean adjustingMapAlpha;
 static boolean isMapView(String id){return id.startsWith("mapCamera");}
 static boolean isMedallion(String id){return id.equals("mapCameraPort")||id.equals("mapCameraStarboard");}
 void setMapAlpha(float value){
  mapAlpha=value;
  for(Tile tile:tiles.values())if(isMapView(tile.id))tile.frame.setAlpha(value);
 }
 boolean stopped=false,mapPaused=false,suspended=false;
 void suspend(){
  if(stopped||suspended)return;
  suspended=true;
  if(recording.active())recording.stop(true,null);
  else clearCaptureAuxiliary();
  dismissPlayback();
  freezeSources();
  for(Tile tile:tiles.values()){
   tile.garland.setPaused(true);
   tile.beacon.clearAnimation();
  }
 }
 void resume(){
  suspended=false;
  mapPaused=false;
  retryAt.clear();
  for(Tile tile:tiles.values()){
   tile.garland.setPaused(false);
   tile.alarm=false;
   tile.beacon.setVisibility(View.GONE);
  }
 }
 void freezeSources(){
  for(Source source:sources.values())source.close();
  sources.clear();
 }
 void pauseForMap(boolean paused){
  if(mapPaused==paused)return;mapPaused=paused;
  if(paused){if(recording.active())recording.stop(true,"Flux mis en pause");else clearCaptureAuxiliary();freezeSources();for(Tile tile:tiles.values())if(tile.snapshot==null)tile.message.setText("Image figée · carte");}
  for(Tile tile:tiles.values()){tile.garland.setPaused(paused);if(paused)tile.beacon.clearAnimation();else if(tile.alarm)tile.alarm=false;}
 }

 class Tile{
  final String id;final FrameLayout frame;final ImageView mirror;final TextView message,banner,footer,beacon;
  final TextView switching;
  boolean alarm=false,active=false;
  int displayedCamera=0,displayedLens=0,cropCamera=0;
  Runnable cancelCenterGestures=()->{};
  float centralZoom=1,focusX=.5f,focusY=.5f;
  Bitmap snapshot;
  Source source;
  TextView refresh;
  final CameraGarland garland=new CameraGarland(activity.getResources().getDisplayMetrics().density);
  int dp(float n){return (int)(n*activity.getResources().getDisplayMetrics().density+.5f);}
  TextView overlay(int size){TextView t=new TextView(activity);t.setTextColor(Color.WHITE);t.setTextSize(size);t.setGravity(Gravity.CENTER);t.setPadding(dp(4),dp(3),dp(4),dp(3));t.setBackgroundColor(0xb3075e9f);return t;}
  Tile(String id){this.id=id;frame=new FrameLayout(activity);frame.setBackgroundColor(Color.BLACK);
   android.graphics.drawable.GradientDrawable shape=new android.graphics.drawable.GradientDrawable();shape.setColor(Color.BLACK);shape.setCornerRadius(dp(8));frame.setBackground(shape);frame.setClipToOutline(true);
   mirror=new ImageView(activity);mirror.setScaleType(ImageView.ScaleType.MATRIX);frame.addView(mirror,new FrameLayout.LayoutParams(-1,-1));
   frame.addOnLayoutChangeListener((view,l,t,r,b,oldL,oldT,oldR,oldB)->{
    if(r-l!=oldR-oldL||b-t!=oldB-oldT)applyCrop();
   });
   message=new TextView(activity);message.setTextColor(Color.WHITE);message.setTextSize(10);message.setGravity(Gravity.CENTER);frame.addView(message,new FrameLayout.LayoutParams(-1,-1));
   banner=overlay(11);banner.setSingleLine(true);banner.setEllipsize(android.text.TextUtils.TruncateAt.END);frame.addView(banner,new FrameLayout.LayoutParams(-1,-2,Gravity.TOP));
   footer=overlay(10);footer.setMaxLines(2);frame.addView(footer,new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM));footer.setVisibility(View.GONE);
   beacon=overlay(42);beacon.setText("⚠");beacon.setBackgroundColor(0xe6e00000);beacon.setVisibility(View.GONE);frame.addView(beacon,new FrameLayout.LayoutParams(dp(70),dp(66),Gravity.CENTER));
   switching=overlay(14);switching.setText("⌛");switching.setContentDescription("Changement de caméra en cours");switching.setBackgroundColor(0x66071d2f);switching.setVisibility(View.GONE);
   FrameLayout.LayoutParams waiting=new FrameLayout.LayoutParams(dp(28),dp(28),Gravity.BOTTOM|Gravity.RIGHT);waiting.rightMargin=dp(8);waiting.bottomMargin=dp(8);frame.addView(switching,waiting);
   if(isMapView(id)){
    if(isMedallion(id)){
     frame.setOutlineProvider(new ViewOutlineProvider(){
      @Override public void getOutline(View view,Outline outline){outline.setOval(0,0,view.getWidth(),view.getHeight());}
     });
     View sheen=new View(activity);
     android.graphics.drawable.GradientDrawable finish=new android.graphics.drawable.GradientDrawable(
       android.graphics.drawable.GradientDrawable.Orientation.TL_BR,
       new int[]{0x99ffffff,0x16ffffff,Color.TRANSPARENT,0xa6000000});
     android.graphics.drawable.GradientDrawable rim=new android.graphics.drawable.GradientDrawable();
     rim.setShape(android.graphics.drawable.GradientDrawable.OVAL);
     rim.setColor(Color.TRANSPARENT);
     rim.setStroke(dp(1),0x88c9edff);
     sheen.setBackground(new android.graphics.drawable.LayerDrawable(
       new android.graphics.drawable.Drawable[]{finish,rim}));
     // Above the video and snapshots, below the camera labels and status.
     frame.addView(sheen,1,new FrameLayout.LayoutParams(-1,-1));
     installCropGesture();
    }else installTransparencyGesture();
    banner.setTextSize(10);
    banner.setBackgroundColor(0xd9ffe24b);
    banner.setTextColor(Color.BLACK);
    banner.setLayoutParams(new FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.CENTER_HORIZONTAL));
    banner.setVisibility(View.GONE);
    frame.setOnClickListener(v->activity.dashboardClick(id,false));
    layer.addView(frame);
    return;
   }
   refresh=overlay(20);refresh.setText("↻");refresh.setContentDescription("Rafraîchir cette caméra");frame.addView(refresh,new FrameLayout.LayoutParams(dp(30),dp(30),Gravity.TOP|Gravity.RIGHT));refresh.setOnClickListener(v->{refreshTile(id);activity.refreshDashboardVideos();});
   frame.setOnClickListener(v->activity.dashboardClick(id,false));
   if(!"trematagePreview".equals(id))
    frame.setOnLongClickListener(v->{activity.dashboardClick(id,true);return true;});
   layer.addView(frame);
  }
  void setSnapshot(Bitmap bitmap){
   snapshot=bitmap;
   mirror.setImageBitmap(bitmap);
   applyCrop();
  }
  void applyCrop(){
   int width=frame.getWidth(),height=frame.getHeight();
   if(width<=0||height<=0)return;
   CameraCrop crop=!id.equals("mapCameraPreview")&&CameraCrop.supported(cropCamera)?crops[cropCamera]:CameraCrop.CENTER;
   float zoom=isMedallion(id)?1.15f:centralZoom;
   boolean magnified=id.equals("mapCameraPreview")&&centralZoom>1;
   if(source!=null){
    float ratio=source.videoRatio/((float)width/height);
    float sx=Math.max(1,ratio)*zoom,sy=Math.max(1,1/ratio)*zoom;
    source.texture.setScaleX(sx);source.texture.setScaleY(sy);
    source.texture.setTranslationX(magnified?(0.5f-focusX)*width*(sx-1):crop.translateX(width*(sx-1)));
    source.texture.setTranslationY(magnified?(0.5f-focusY)*height*(sy-1):crop.translateY(height*(sy-1)));
   }
   if(snapshot!=null){
    float scale=Math.max((float)width/snapshot.getWidth(),(float)height/snapshot.getHeight())*zoom;
    float extraX=snapshot.getWidth()*scale-width,extraY=snapshot.getHeight()*scale-height;
    Matrix matrix=new Matrix();
    matrix.setScale(scale,scale);
    matrix.postTranslate(-extraX/2+(magnified?(.5f-focusX)*extraX:crop.translateX(extraX)),-extraY/2+(magnified?(.5f-focusY)*extraY:crop.translateY(extraY)));
    mirror.setImageMatrix(matrix);
   }
  }
  void installCropGesture(){
   frame.setOnTouchListener(new View.OnTouchListener(){
    float startX,startY;
    int camera;
    CameraCrop initial;
    boolean dragging;
    @Override public boolean onTouch(View view,MotionEvent event){
     switch(event.getActionMasked()){
      case MotionEvent.ACTION_DOWN:
       camera=cropCamera;
       if(!CameraCrop.supported(camera))return false;
       initial=crops[camera];startX=event.getRawX();startY=event.getRawY();
       dragging=false;
       return false;
      case MotionEvent.ACTION_MOVE:
       if(initial==null)return false;
       float dx=event.getRawX()-startX,dy=event.getRawY()-startY;
       if(!dragging){
        if(Math.hypot(dx,dy)<=ViewConfiguration.get(activity).getScaledTouchSlop())return false;
        dragging=true;draggingCamera=camera;
        MotionEvent cancel=MotionEvent.obtain(event);
        cancel.setAction(MotionEvent.ACTION_CANCEL);
        view.onTouchEvent(cancel);cancel.recycle();
       }
       applyCameraCrop(camera,initial.drag(dx,dy,view.getWidth(),view.getHeight()));
       return true;
      case MotionEvent.ACTION_UP:
      case MotionEvent.ACTION_CANCEL:
       if(!dragging){initial=null;return false;}
       if(event.getActionMasked()==MotionEvent.ACTION_UP){
        settings.edit().putString(CameraCrop.key(camera),crops[camera].encode()).apply();
        activity.refreshDashboardVideos();
       }else applyCameraCrop(camera,initial);
       dragging=false;draggingCamera=0;initial=null;
       return true;
      default:
       return dragging;
     }
    }
   });
  }
  void acknowledgeTap(float x,float y,boolean twice){
   View pulse=new View(activity);
   android.graphics.drawable.GradientDrawable outer=new android.graphics.drawable.GradientDrawable();
   outer.setShape(android.graphics.drawable.GradientDrawable.OVAL);outer.setColor(Color.TRANSPARENT);outer.setStroke(dp(2),0xddbcefff);
   if(twice){
    android.graphics.drawable.GradientDrawable inner=new android.graphics.drawable.GradientDrawable();
    inner.setShape(android.graphics.drawable.GradientDrawable.OVAL);inner.setColor(Color.TRANSPARENT);inner.setStroke(dp(2),0xddbcefff);
    android.graphics.drawable.LayerDrawable rings=new android.graphics.drawable.LayerDrawable(new android.graphics.drawable.Drawable[]{outer,inner});
    rings.setLayerInset(1,dp(9),dp(9),dp(9),dp(9));pulse.setBackground(rings);
   }else pulse.setBackground(outer);
   pulse.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
   FrameLayout.LayoutParams bounds=new FrameLayout.LayoutParams(dp(52),dp(52));bounds.leftMargin=Math.round(x-dp(26));bounds.topMargin=Math.round(y-dp(26));frame.addView(pulse,bounds);
   pulse.setScaleX(.65f);pulse.setScaleY(.65f);
   pulse.animate().scaleX(1.6f).scaleY(1.6f).alpha(0).setDuration(550).withEndAction(()->frame.removeView(pulse)).start();
  }
  void installTransparencyGesture(){
   frame.setOnTouchListener(new View.OnTouchListener(){
    float startX,startY,startAlpha,startFocusX,startFocusY;
    boolean panning;
    boolean center,dragged,held,multi,second;
    long lastTap;
    float tapX,tapY;
    final Runnable click=()->{if(frame.isShown()){acknowledgeTap(tapX,tapY,false);frame.performClick();}};
    final Runnable align=()->{
     if(!frame.isShown()||multi)return;
     frame.removeCallbacks(click);lastTap=0;held=true;
     acknowledgeTap(tapX,tapY,false);activity.dashboardClick(id,true);
    };
    {cancelCenterGestures=()->{frame.removeCallbacks(click);frame.removeCallbacks(align);lastTap=0;held=true;multi=true;adjustingMapAlpha=false;};}
    final ScaleGestureDetector pinch=new ScaleGestureDetector(activity,new ScaleGestureDetector.SimpleOnScaleGestureListener(){
     @Override public boolean onScale(ScaleGestureDetector detector){
      centralZoom=Math.max(1f,Math.min(6f,centralZoom*detector.getScaleFactor()));
      focusX=Math.max(0,Math.min(1,detector.getFocusX()/Math.max(1,frame.getWidth())));
      focusY=Math.max(0,Math.min(1,detector.getFocusY()/Math.max(1,frame.getHeight())));
      applyCrop();return true;
     }
    });
    @Override public boolean onTouch(View view,MotionEvent event){
     if(event.getActionMasked()==MotionEvent.ACTION_POINTER_DOWN){
      multi=true;view.removeCallbacks(align);view.removeCallbacks(click);lastTap=0;
      adjustingMapAlpha=false;setMapAlpha(startAlpha);
     }
     pinch.onTouchEvent(event);
     switch(event.getActionMasked()){
      case MotionEvent.ACTION_DOWN:
       second=lastTap>0&&event.getEventTime()-lastTap<=ViewConfiguration.getDoubleTapTimeout()
        &&Math.hypot(event.getX()-tapX,event.getY()-tapY)<ViewConfiguration.get(activity).getScaledDoubleTapSlop();
       if(second)view.removeCallbacks(click);
       center=Math.abs(event.getX()-view.getWidth()/2f)<=view.getWidth()/6f;
       tapX=event.getX();tapY=event.getY();
       startX=event.getRawX();startY=event.getRawY();startAlpha=mapAlpha;
       startFocusX=focusX;startFocusY=focusY;panning=centralZoom>1.01f;
       dragged=false;held=false;multi=false;
       view.removeCallbacks(align);view.postDelayed(align,600);return true;
      case MotionEvent.ACTION_MOVE:
       if(held||multi)return true;
       float delta=event.getRawY()-startY;
       int slop=ViewConfiguration.get(activity).getScaledTouchSlop();
       if(Math.hypot(event.getRawX()-startX,delta)>slop){
        view.removeCallbacks(align);view.removeCallbacks(click);lastTap=0;dragged=true;
       }
       if(panning&&dragged){
        float ratio=source!=null?source.videoRatio:snapshot!=null?(float)snapshot.getWidth()/snapshot.getHeight():(float)view.getWidth()/view.getHeight();
        float fit=ratio/((float)view.getWidth()/view.getHeight());
        float extraX=view.getWidth()*(Math.max(1,fit)*centralZoom-1);
        float extraY=view.getHeight()*(Math.max(1,1/fit)*centralZoom-1);
        focusX=Math.max(0,Math.min(1,startFocusX-(event.getRawX()-startX)/Math.max(1,extraX)));
        focusY=Math.max(0,Math.min(1,startFocusY-delta/Math.max(1,extraY)));
        applyCrop();
       }else if(center&&dragged){
        adjustingMapAlpha=true;
        setMapAlpha(Math.max(.15f,Math.min(1f,startAlpha+delta/view.getHeight())));
       }
       return true;
      case MotionEvent.ACTION_UP:
      case MotionEvent.ACTION_CANCEL:
       view.removeCallbacks(align);
       if(event.getActionMasked()==MotionEvent.ACTION_UP&&!dragged&&!held&&!multi){
        if(second){
         acknowledgeTap(event.getX(),event.getY(),true);
         lastTap=0;centralZoom=centralZoom>1?1:2.5f;
         focusX=event.getX()/Math.max(1,view.getWidth());focusY=event.getY()/Math.max(1,view.getHeight());applyCrop();
        }else{
         lastTap=event.getEventTime();tapX=event.getX();tapY=event.getY();
         view.postDelayed(click,ViewConfiguration.getDoubleTapTimeout());
        }
       }else{view.removeCallbacks(click);lastTap=0;}
       if(dragged&&!multi&&!panning)activity.updateMapCameraAlpha(mapAlpha);
       adjustingMapAlpha=false;return true;
      default:return true;
     }
    }
   });
  }
  void decorate(JSONObject data){
   active=data.optBoolean("active",false);
   String number=data.optString("number","");
   int refreshNumber=100+data.optInt("number",0);
   refresh.setText(number.isEmpty()?"↻":"↻"+refreshNumber);
   refresh.setTextSize(number.isEmpty()?20:9);
   refresh.setContentDescription("Rafraîchir cette caméra"+(number.isEmpty()?"":" · "+refreshNumber));
   banner.setText((number.isEmpty()?"":number+" · ")+data.optString("label","📷"));footer.setText(data.optString("status",""));footer.setVisibility(footer.length()==0?View.GONE:View.VISIBLE);
   boolean next=data.optBoolean("alarm",false);
   if(next!=alarm){alarm=next;beacon.clearAnimation();beacon.setVisibility(alarm?View.VISIBLE:View.GONE);
    if(alarm){android.view.animation.AlphaAnimation blink=new android.view.animation.AlphaAnimation(1f,.12f);blink.setDuration(500);blink.setRepeatMode(android.view.animation.Animation.REVERSE);blink.setRepeatCount(android.view.animation.Animation.INFINITE);beacon.startAnimation(blink);}
   }
   android.graphics.drawable.GradientDrawable border=new android.graphics.drawable.GradientDrawable();border.setColor(Color.TRANSPARENT);border.setCornerRadius(dp(8));border.setStroke(dp(alarm?6:2),alarm?0xffff2424:data.optBoolean("active",false)?0xff4be0b0:0xff287398);if(active&&!alarm){if(frame.getForeground()!=garland)frame.setForeground(garland);}else frame.setForeground(border);
   // Keep the beacon large but inside even a narrow portrait thumbnail.
   FrameLayout.LayoutParams bp=(FrameLayout.LayoutParams)beacon.getLayoutParams();FrameLayout.LayoutParams fp=(FrameLayout.LayoutParams)frame.getLayoutParams();bp.width=Math.max(24,Math.min(dp(70),fp.width*2/3));bp.height=Math.max(24,Math.min(dp(66),fp.height/2));beacon.setTextSize(Math.max(22,Math.min(42,bp.height/activity.getResources().getDisplayMetrics().density*.7f)));beacon.setLayoutParams(bp);
  }
 }
 class Source{
  final String uri;final ExoPlayer player;final TextureView texture;final Tile owner;final List<Tile> mirrors=new ArrayList<>();
  float videoRatio=16f/9f;
  volatile long lastFrame=0;
  final long created=System.currentTimeMillis();
  boolean failed=false,rendered=false;
  Source(String uri,Tile owner){this.uri=uri;this.owner=owner;texture=new TextureView(activity);owner.frame.addView(texture,0,new FrameLayout.LayoutParams(-1,-1));
   owner.source=this;owner.applyCrop();
   player=new ExoPlayer.Builder(activity,new DefaultRenderersFactory(activity).setEnableDecoderFallback(true)).build();player.setVolume(0);player.setVideoTextureView(texture);
   player.setVideoFrameMetadataListener((presentationTimeUs,releaseTimeNs,format,mediaFormat)->lastFrame=System.currentTimeMillis());
   player.addListener(new Player.Listener(){
    @Override public void onRenderedFirstFrame(){
     if(owner.source!=Source.this)return;
     rendered=true;
     // Keep the previous picture until the new texture has reached the UI frame.
     owner.frame.postOnAnimation(()->{
      if(owner.source!=Source.this)return;
      owner.setSnapshot(null);
      owner.message.setText("");
      owner.switching.setVisibility(View.GONE);
     });
    }
    @Override public void onPlayerError(PlaybackException e){
     failed=true;retryAt.put(uri,System.currentTimeMillis()+4000);
     owner.switching.setVisibility(View.GONE);
     for(Tile tile:mirrors)tile.switching.setVisibility(View.GONE);
     if(e.getErrorCodeName().contains("DECOD"))decoderBudget=Math.max(1,Math.min(decoderBudget,sources.size()-1));
     if(owner.snapshot==null)owner.message.setText("Relance · "+e.getErrorCodeName());
     for(Tile tile:mirrors)if(tile.snapshot==null)tile.message.setText(owner.message.getText());
    }
    @Override public void onVideoSizeChanged(VideoSize size){
     if(size.width<=0||size.height<=0||size.pixelWidthHeightRatio<=0)return;
     videoRatio=size.width*size.pixelWidthHeightRatio/size.height;
     owner.applyCrop();
    }
   });
   player.setMediaSource(new RtspMediaSource.Factory().setForceUseRtpTcp(true).createMediaSource(MediaItem.fromUri(uri)));player.prepare();player.play();
  }
  Bitmap capture(){
   if(!rendered||!texture.isAvailable()||lastFrame==0)return null;
   // View transformations only affect display. Each tile crops its own copy of the full frame.
   int width=Math.max(1,Math.round(320*Math.min(1,videoRatio)));
   int height=Math.max(1,Math.round(320*Math.min(1,1/videoRatio)));
   try{
    Bitmap bitmap=texture.getBitmap(width,height);
    if(bitmap!=null)bitmap.setDensity(Bitmap.DENSITY_NONE);
    return bitmap;
   }catch(RuntimeException ignored){return null;}
  }
  void close(){
   Bitmap snapshot=stopped?null:capture();
   if(snapshot!=null){
    owner.setSnapshot(snapshot);
    for(Tile tile:mirrors)tile.setSnapshot(snapshot);
    owner.message.setText("");
    for(Tile tile:mirrors)tile.message.setText("");
   }
   player.release();owner.frame.removeView(texture);owner.source=null;
  }
  void copy(){
   if(mirrors.isEmpty())return;
   Bitmap snapshot=capture();
   if(snapshot==null)return;
   for(Tile tile:mirrors){tile.setSnapshot(snapshot);tile.message.setText(owner.message.getText());tile.switching.setVisibility(View.GONE);}
  }
 }
 DashboardCameras(MainActivity activity,FrameLayout layer){
  this.activity=activity;this.layer=layer;recording=new DashboardRecording(activity,()->{clearCaptureAuxiliary();activity.refreshDashboardVideos();});
  settings=activity.getSharedPreferences("nautic_settings",MainActivity.MODE_PRIVATE);
  for(int camera=1;camera<=3;camera++)crops[camera]=CameraCrop.read(settings.getString(CameraCrop.key(camera),""));
 }
 void applyCameraCrop(int camera,CameraCrop crop){
  crops[camera]=crop;
  for(Tile tile:tiles.values())if(tile.cropCamera==camera)tile.applyCrop();
 }
 void update(String json){
  if(stopped||mapPaused||suspended||recording.active()||captureWait!=null)return;
  try{
   JSONObject data=new JSONObject(json);JSONArray list=data.getJSONArray("tiles");double width=data.getDouble("width");if(width<=0)return;double scale=layer.getWidth()/width;
   for(int camera=1;camera<=3;camera++)if(camera!=draggingCamera){
    applyCameraCrop(camera,CameraCrop.read(settings.getString(CameraCrop.key(camera),"")));
   }
   int reset=data.optInt("centerReset",0);
   if(reset!=lastCenterReset){
    lastCenterReset=reset;Tile central=tiles.get("mapCameraPreview");
    if(central!=null){central.cancelCenterGestures.run();central.centralZoom=1;central.focusX=.5f;central.focusY=.5f;central.applyCrop();}
   }
   uiOpacity=(float)Math.max(.20,Math.min(1,data.optDouble("uiOpacity",.60)));
   if(!adjustingMapAlpha)setMapAlpha((float)data.optDouble("mapCameraAlpha",1));
   Set<String> visible=new HashSet<>();Map<String,List<Tile>> grouped=new LinkedHashMap<>();
   for(int i=0;i<list.length();i++){
    JSONObject item=list.getJSONObject(i);String id=item.getString("id");if(!id.matches("cam[123]Body|trematagePreview|mapCameraPreview|mapCameraPort|mapCameraStarboard"))continue;
    visible.add(id);Tile tile=tiles.get(id);if(tile==null){tile=new Tile(id);tiles.put(id,tile);}
    FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(Math.max(1,(int)(item.getDouble("w")*scale)),Math.max(1,(int)(item.getDouble("h")*scale)));lp.leftMargin=(int)(item.getDouble("x")*scale);lp.topMargin=(int)(item.getDouble("y")*scale);tile.frame.setLayoutParams(lp);tile.frame.setVisibility(View.VISIBLE);tile.frame.setAlpha(.5f);
    boolean inMap=isMapView(id);
    if(inMap){tile.frame.setAlpha(mapAlpha*.5f);tile.frame.bringToFront();}
    if(!inMap)tile.decorate(item);
    boolean mobile=id.equals("trematagePreview");
    int index=inMap?item.optInt("camera",2):mobile?TrematageAccess.index(activity):CameraDisplaySource.index(activity,id.charAt(3)-'0');
    tile.cropCamera=inMap?index:mobile?0:id.charAt(3)-'0';
    tile.applyCrop();
    int lens=inMap?item.optInt("lens",index==2?2:0):0;
    if(inMap){
     if(index<1||index>3)continue;
     if(tile.displayedCamera!=index||tile.displayedLens!=lens){
      if(id.equals("mapCameraPreview"))tile.switching.setVisibility(View.VISIBLE);
      tile.cancelCenterGestures.run();tile.centralZoom=1;tile.focusX=.5f;tile.focusY=.5f;tile.applyCrop();
      tile.displayedCamera=index;tile.displayedLens=lens;
     }
     String number=item.optString("number","");
     tile.banner.setText(number.isEmpty()?"":number+" · "+(40+index));
     tile.banner.setVisibility(number.isEmpty()?View.GONE:View.VISIBLE);
     String action=id.equals("mapCameraPreview")?"":" · toucher pour échanger, glisser pour recadrer";
     tile.frame.setContentDescription("Caméra "+(40+index)+action);
    }
    String url=TrematageAccess.address(activity,index);
    if(!url.startsWith("rtsp://")){tile.message.setText("📷");continue;}
    Uri uri=Uri.parse(url);android.content.SharedPreferences p=activity.getSharedPreferences("nautic_camera_private",0);
    String user=p.getString("username"+index,p.getString("username","")),pass=p.getString("password"+index,p.getString("password",""));
    if(user.isEmpty()){tile.message.setText("⚙ Identifiants caméra");continue;}
    String tapoHost=Uri.parse(TrematageAccess.address(activity,TrematageAccess.index(activity))).getHost();
    String path=uri.getPath();
    if(lens!=0)path=lens==1?"/stream6":"/stream1";
    boolean tapo=lens!=0||index==1||java.util.Objects.equals(tapoHost,uri.getHost());
    if(inMap&&tapo&&(path==null||path.isEmpty()))path="/stream1";
    path=inMap&&tapo&&CameraStreamPolicy.hasTapoQualityPair(path)
     ?CameraStreamPolicy.viewingQuality(path,!data.optBoolean("mapHd",false))
     :CameraStreamPolicy.preview(path,mobile,tapo);
    String stream="rtsp://"+Uri.encode(user)+":"+Uri.encode(pass)+"@"+uri.getHost()+":"+(uri.getPort()>0?uri.getPort():554)+path;
    if(!grouped.containsKey(stream))grouped.put(stream,new ArrayList<>());if(id.equals("mapCameraPreview"))grouped.get(stream).add(0,tile);else grouped.get(stream).add(tile);
   }
   for(Tile t:tiles.values())if(!visible.contains(t.id))t.frame.setVisibility(View.GONE);
   qualityButton=updateMapButton(qualityButton,data.optJSONObject("qualityButton"),scale,
     "mapCameraQuality","Qualité vidéo commune aux objectifs");
   medallionButton=updateMapButton(medallionButton,data.optJSONObject("medallionButton"),scale,
     "mapCameraMedallionToggle","Afficher ou masquer les médaillons");
   axisButton=updateMapButton(axisButton,data.optJSONObject("axisButton"),scale,
     "mapCameraAxis","Aligner ou rétablir l’orientation de l’objectif mobile");
   captureButton=updateMapButton(captureButton,data.optJSONObject("captureButton"),scale,
     "mapCameraCaptureMenu","Photo, vidéo et captures");
   if(playback!=null){
    Tile central=tiles.get("mapCameraPreview");
    if(central==null||central.frame.getVisibility()!=View.VISIBLE)dismissPlayback();
    else{playback.setLayoutParams(new FrameLayout.LayoutParams((FrameLayout.LayoutParams)central.frame.getLayoutParams()));playback.bringToFront();}
   }


   long now=System.currentTimeMillis();
   List<String> eligible=new ArrayList<>();String priority=null;
   for(Map.Entry<String,List<Tile>> e:grouped.entrySet()){
    if(retryAt.containsKey(e.getKey())&&retryAt.get(e.getKey())>now)continue;
    eligible.add(e.getKey());for(Tile tile:e.getValue())if(tile.id.equals("mapCameraPreview")||(priority==null&&tile.id.equals("trematagePreview")&&tile.active))priority=e.getKey();
   }
   Set<String> selected=new HashSet<>();if(priority!=null){selected.add(priority);eligible.remove(priority);}
   int start=eligible.isEmpty()?0:(int)((now/8000)%eligible.size());
   for(int i=0;i<eligible.size()&&selected.size()<decoderBudget;i++)selected.add(eligible.get((start+i)%eligible.size()));
   Iterator<Map.Entry<String,Source>> iterator=sources.entrySet().iterator();while(iterator.hasNext()){
    Map.Entry<String,Source> entry=iterator.next();List<Tile> group=grouped.get(entry.getKey());
    Source source=entry.getValue();
    boolean stalled=now-(source.lastFrame==0?source.created:source.lastFrame)>(source.lastFrame==0?14000:9000);
    if(stalled)retryAt.put(entry.getKey(),now+2000);
    if(group==null||group.get(0)!=source.owner||!selected.contains(entry.getKey())||source.failed||stalled){source.close();iterator.remove();if(stalled||source.failed)selected.remove(entry.getKey());}
   }
   // Source.close() retained the outgoing frame. A new source removes that
   // cover only after its first rendered frame; mirrors replace it on copy().
   for(Map.Entry<String,List<Tile>> e:grouped.entrySet()){
    if(!selected.contains(e.getKey()))continue;
    Source source=sources.get(e.getKey());if(source==null){Tile owner=e.getValue().get(0);owner.message.setText(owner.snapshot==null?"◌":"");source=new Source(e.getKey(),owner);sources.put(e.getKey(),source);}
    source.mirrors.clear();for(Tile t:e.getValue())if(t!=source.owner)source.mirrors.add(t);source.copy();
   }
  }catch(Exception ignored){}
 }
 private void openCaptureMenu(){
  if(captureButton==null||!captureButton.isShown()||recording.active()||captureWait!=null||playback!=null)return;
  android.widget.PopupMenu menu=new android.widget.PopupMenu(activity,captureButton,Gravity.END);
  menu.getMenu().add(0,149,0,"Photo");
  menu.getMenu().add(0,150,1,"Vidéo");
  menu.getMenu().add(0,152,2,"Dernière vidéo").setEnabled(DashboardRecording.latest(activity)!=null);
  menu.getMenu().add(0,154,3,"Dossier des captures");
  menu.setOnMenuItemClickListener(item->{
   menu.dismiss();
   String action=item.getItemId()==149?"photo":item.getItemId()==150?"record":item.getItemId()==154?"captures":"play";
   captureButton.post(()->captureAction(action));
   return true;
  });
  menu.show();
 }
 void captureAction(String action){
  if("menu".equals(action)){openCaptureMenu();return;}
  Tile central=tiles.get("mapCameraPreview");
  if(central==null||central.frame.getVisibility()!=View.VISIBLE)return;
  if("captures".equals(action)){showCaptures(central);return;}
  if("play".equals(action)){showLatestVideo(central);return;}
  if(playback!=null||recording.active()||captureWait!=null)return;
  if(!"photo".equals(action)&&!"record".equals(action))return;
  Source source=central.source;
  if(source==null)for(Source candidate:sources.values())if(candidate.mirrors.contains(central)){source=candidate;break;}
  if(!live(source)){
   Toast.makeText(activity,"Attends l’image en direct de la caméra",Toast.LENGTH_SHORT).show();return;
  }
  String path=Uri.parse(source.uri).getPath();
  String secondPath=CameraStreamPolicy.otherLens(path);
  if(secondPath==null){
   Toast.makeText(activity,"La capture double nécessite les deux flux RTSP de la Tapo",Toast.LENGTH_LONG).show();return;
  }
  String otherUri=source.uri.substring(0,source.uri.length()-path.length())+secondPath;
  Source other=sources.get(otherUri);
  if(other==null||other.failed){
   Tile auxiliary=new Tile("mapCameraCaptureAux");
   FrameLayout.LayoutParams bounds=new FrameLayout.LayoutParams(320,180);
   bounds.leftMargin=central.frame.getLeft();bounds.topMargin=central.frame.getTop();
   layer.removeView(auxiliary.frame);
   layer.addView(auxiliary.frame,0,bounds);
   auxiliary.frame.setAlpha(.01f);
   try{other=captureAuxiliary=new Source(otherUri,auxiliary);}
   catch(RuntimeException failure){layer.removeView(auxiliary.frame);Toast.makeText(activity,"Second objectif indisponible",Toast.LENGTH_LONG).show();return;}
  }
  boolean mobile=path.equals("/stream6")||path.equals("/stream7");
  Source fixed=mobile?other:source,moving=mobile?source:other;
  long timeout=android.os.SystemClock.elapsedRealtime()+12000;
  captureWait=new Runnable(){
   @Override public void run(){
    if(live(fixed)&&live(moving)){
     captureWait=null;
     DashboardRecording.Lens first=new DashboardRecording.Lens("fixe",fixed.texture,fixed.videoRatio,()->live(fixed));
     DashboardRecording.Lens second=new DashboardRecording.Lens("mobile",moving.texture,moving.videoRatio,()->live(moving));
     if("photo".equals(action))recording.photo(first,second);
     else recording.start(first,second);
     return;
    }
    if(fixed.failed||moving.failed||android.os.SystemClock.elapsedRealtime()>=timeout){
     clearCaptureAuxiliary();
     Toast.makeText(activity,"Capture annulée · les deux objectifs doivent être en direct",Toast.LENGTH_LONG).show();
    }else layer.postDelayed(this,100);
   }
  };
  if(!live(other))Toast.makeText(activity,"Ouverture du second objectif…",Toast.LENGTH_SHORT).show();
  captureWait.run();
 }
 private boolean live(Source source){
  return source!=null&&!source.failed&&source.lastFrame>0&&System.currentTimeMillis()-source.lastFrame<3000&&source.texture.isAvailable();
 }
 private void clearCaptureAuxiliary(){
  if(captureWait!=null){layer.removeCallbacks(captureWait);captureWait=null;}
  if(captureAuxiliary!=null){
   Source auxiliary=captureAuxiliary;captureAuxiliary=null;
   auxiliary.close();layer.removeView(auxiliary.owner.frame);
  }
 }
 private void showLatestVideo(Tile central){
  java.io.File[] files=DashboardRecording.latestPair(activity);
  if(files.length==0||recording.active()||captureWait!=null)return;
  if(files.length==1){playVideo(central,files[0]);return;}
  new android.app.AlertDialog.Builder(activity).setTitle("Dernier enregistrement")
   .setItems(new String[]{"Objectif fixe","Objectif mobile"},(dialog,index)->playVideo(central,files[index])).show();
 }
 private void showCaptures(Tile central){
  java.io.File[] files=DashboardRecording.captures(activity);
  Set<java.io.File> selected=new LinkedHashSet<>();
  android.util.LruCache<java.io.File,Bitmap> thumbnails=new android.util.LruCache<>(32);
  java.text.DateFormat date=java.text.DateFormat.getDateTimeInstance(
   java.text.DateFormat.SHORT,java.text.DateFormat.MEDIUM,Locale.FRANCE);
  LinearLayout content=new LinearLayout(activity);
  content.setOrientation(LinearLayout.VERTICAL);
  ListView list=new ListView(activity);
  if(files.length>0)content.addView(list,new LinearLayout.LayoutParams(-1,0,1));
  else{
   TextView empty=new TextView(activity);
   empty.setText("Aucune photo ni vidéo enregistrée.");
   empty.setPadding(dp(20),dp(12),dp(20),dp(12));
   content.addView(empty);
  }
  TextView path=new TextView(activity);
  path.setId(157);
  path.setText("Ouvrir dans Fichiers Android\n"+DashboardRecording.directory(activity).getAbsolutePath());
  path.setPaintFlags(path.getPaintFlags()|Paint.UNDERLINE_TEXT_FLAG);
  path.setOnClickListener(view->activity.openCaptureDirectory());
  path.setTextSize(12);
  path.setPadding(dp(16),dp(12),dp(16),dp(8));
  content.addView(path,new LinearLayout.LayoutParams(-1,-2));
  android.app.AlertDialog dialog=new android.app.AlertDialog.Builder(activity)
   .setTitle("Dossier des captures").setView(content)
   .setNegativeButton("Fermer",null)
   .setNeutralButton("Récentes ↓",null)
   .setPositiveButton("Supprimer",null).create();
  BaseAdapter adapter=new BaseAdapter(){
   @Override public int getCount(){return files.length;}
   @Override public Object getItem(int position){return files[position];}
   @Override public long getItemId(int position){return position;}
   @Override public View getView(int position,View recycled,ViewGroup parent){
    java.io.File file=files[position];
    boolean photo=file.getName().endsWith(".jpg");
    LinearLayout row=(LinearLayout)recycled;
    if(row==null){
     row=new LinearLayout(activity);
     row.setGravity(Gravity.CENTER_VERTICAL);
     row.setPadding(dp(12),dp(4),dp(12),dp(4));
     CheckBox box=new CheckBox(activity);
     row.addView(box,new LinearLayout.LayoutParams(dp(48),dp(48)));
     ImageView thumbnail=new ImageView(activity);
     thumbnail.setScaleType(ImageView.ScaleType.CENTER_CROP);
     row.addView(thumbnail,new LinearLayout.LayoutParams(dp(56),dp(42)));
     TextView caption=new TextView(activity);
     caption.setPadding(dp(12),dp(8),0,dp(8));
     row.addView(caption,new LinearLayout.LayoutParams(0,-2,1));
    }
    String name=file.getName();
    String lens=name.contains("-fixe.")?" · Fixe":name.contains("-mobile.")?" · Mobile":"";
    String label=(photo?"Photo":"Vidéo")+lens+" · "+date.format(new Date(file.lastModified()));
    CheckBox box=(CheckBox)row.getChildAt(0);
    box.setOnCheckedChangeListener(null);
    box.setVisibility(photo?View.VISIBLE:View.INVISIBLE);
    box.setContentDescription("Sélectionner "+label);
    box.setChecked(selected.contains(file));
    box.setOnCheckedChangeListener((button,checked)->{
     if(checked)selected.add(file);else selected.remove(file);
     Button remove=dialog.getButton(android.app.AlertDialog.BUTTON_POSITIVE);
     remove.setEnabled(!selected.isEmpty());
     remove.setText(selected.isEmpty()?"Supprimer":"Supprimer ("+selected.size()+")");
    });
    ImageView thumbnail=(ImageView)row.getChildAt(1);
    Bitmap image=photo?thumbnails.get(file):null;
    if(photo&&image==null){
     BitmapFactory.Options options=new BitmapFactory.Options();
     options.inSampleSize=8;
     image=BitmapFactory.decodeFile(file.getAbsolutePath(),options);
     if(image!=null)thumbnails.put(file,image);
    }
    thumbnail.setImageBitmap(image);
    TextView caption=(TextView)row.getChildAt(2);
    caption.setText(label);
    View.OnClickListener open=view->{dialog.dismiss();showCaptureActions(central,file,label);};
    row.setOnClickListener(open);
    return row;
   }
  };
  list.setAdapter(adapter);
  dialog.show();
  Button remove=dialog.getButton(android.app.AlertDialog.BUTTON_POSITIVE);
  remove.setId(156);
  remove.setEnabled(false);
  remove.setOnClickListener(view->new android.app.AlertDialog.Builder(activity)
   .setTitle("Supprimer les photos sélectionnées ?")
   .setMessage(selected.size()+" photo(s)")
   .setNegativeButton("Annuler",null)
   .setPositiveButton("Supprimer",(confirmation,button)->{
    int failures=0;
    for(java.io.File file:selected)if(!file.delete())failures++;
    if(failures>0)Toast.makeText(activity,failures+" suppression(s) impossible(s)",Toast.LENGTH_SHORT).show();
    dialog.dismiss();
    showCaptures(central);
   }).show());
  Button sort=dialog.getButton(android.app.AlertDialog.BUTTON_NEUTRAL);
  sort.setId(155);
  sort.setEnabled(files.length>1);
  sort.setOnClickListener(view->{
   Collections.reverse(Arrays.asList(files));
   sort.setText("Récentes ↓".contentEquals(sort.getText())?"Anciennes ↑":"Récentes ↓");
   adapter.notifyDataSetChanged();
   list.setSelection(0);
  });
 }
 private void showCaptureActions(Tile central,java.io.File file,String label){
  new android.app.AlertDialog.Builder(activity).setTitle(label)
   .setItems(new String[]{"Ouvrir","Déplacer","Supprimer"},(dialog,action)->{
    switch(action){
     case 0:
      if(file.getName().endsWith(".mp4"))playVideo(central,file);
      else showCapturePhoto(file,label);
      break;
     case 1:
      activity.chooseCaptureDestination(file.getName());
      break;
     case 2:
      new android.app.AlertDialog.Builder(activity).setTitle("Supprimer cette capture ?")
       .setMessage(label).setNegativeButton("Annuler",(confirmation,button)->showCaptures(central))
       .setPositiveButton("Supprimer",(confirmation,button)->{
        if(!file.delete())Toast.makeText(activity,"Suppression impossible",Toast.LENGTH_SHORT).show();
        showCaptures(central);
       }).show();
      break;
    }
   }).setNegativeButton("Retour",(dialog,button)->showCaptures(central)).show();
 }
 private void showCapturePhoto(java.io.File file,String title){
  Bitmap photo=BitmapFactory.decodeFile(file.getAbsolutePath());
  if(photo==null){
   Toast.makeText(activity,"Ouverture de la photo impossible",Toast.LENGTH_SHORT).show();
   return;
  }
  ImageView view=new ImageView(activity);
  view.setAdjustViewBounds(true);
  view.setScaleType(ImageView.ScaleType.FIT_CENTER);
  view.setImageBitmap(photo);
  android.app.AlertDialog dialog=new android.app.AlertDialog.Builder(activity).setTitle(title)
   .setView(view).setPositiveButton("Fermer",null).create();
  dialog.setOnDismissListener(closed->{view.setImageDrawable(null);});
  dialog.show();
 }
 private void playVideo(Tile central,java.io.File file){
  dismissPlayback();
  playback=new FrameLayout(activity);
  playback.setBackgroundColor(Color.BLACK);
  androidx.media3.ui.PlayerView view=new androidx.media3.ui.PlayerView(activity);
  view.setUseController(false);
  playback.addView(view,new FrameLayout.LayoutParams(-1,-1));
  android.widget.Button close=new android.widget.Button(activity);
  close.setText("Retour direct");
  close.setOnClickListener(v->dismissPlayback());
  playback.addView(close,new FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.RIGHT));
  layer.addView(playback,new FrameLayout.LayoutParams((FrameLayout.LayoutParams)central.frame.getLayoutParams()));
  playbackPlayer=new ExoPlayer.Builder(activity).build();
  view.setPlayer(playbackPlayer);
  playbackPlayer.addListener(new Player.Listener(){
   @Override public void onPlayerError(PlaybackException error){
    Toast.makeText(activity,"Lecture de la vidéo impossible",Toast.LENGTH_SHORT).show();
    dismissPlayback();
   }
  });
  playbackPlayer.setMediaItem(MediaItem.fromUri(Uri.fromFile(file)));
  playbackPlayer.prepare();
  playbackPlayer.play();
 }
 boolean dismissPlayback(){
  if(playback==null)return false;
  if(playbackPlayer!=null){playbackPlayer.release();playbackPlayer=null;}
  layer.removeView(playback);playback=null;
  return true;
 }
 TextView updateMapButton(TextView button,JSONObject bounds,double scale,String id,String description){
  if(bounds==null){
   if(button!=null)button.setVisibility(View.GONE);
   return button;
  }
  if(button==null){
   button=new TextView(activity);
   button.setGravity(Gravity.CENTER);
   button.setTextColor(Color.WHITE);
   button.setOnClickListener(v->activity.dashboardClick(id,false));
   layer.addView(button);
  }
  String label=bounds.optString("label"),number=bounds.optString("number","");
  boolean pressed=bounds.optBoolean("pressed");
  button.setText(number.isEmpty()?label:label+"\n"+number);
  button.setContentDescription(id.equals("mapCameraMedallionToggle")?
    (pressed?"Masquer les médaillons":"Afficher les médaillons"):description);
  button.setTextSize(number.isEmpty()?20:14);
  android.graphics.drawable.GradientDrawable background=new android.graphics.drawable.GradientDrawable();
  background.setColor((Math.round(uiOpacity*255)<<24)|(pressed?0x1b6257:0x092f43));
  background.setCornerRadius(8*activity.getResources().getDisplayMetrics().density);
  button.setBackground(background);
  FrameLayout.LayoutParams layout=new FrameLayout.LayoutParams(
   Math.max(1,(int)(bounds.optDouble("w")*scale)),Math.max(1,(int)(bounds.optDouble("h")*scale)));
  layout.leftMargin=(int)(bounds.optDouble("x")*scale);
  layout.topMargin=(int)(bounds.optDouble("y")*scale);
  button.setLayoutParams(layout);
  button.setVisibility(View.VISIBLE);
  button.bringToFront();
  return button;
 }
 void refreshTile(String id){Iterator<Map.Entry<String,Source>> entries=sources.entrySet().iterator();while(entries.hasNext()){Map.Entry<String,Source> e=entries.next();Source source=e.getValue();boolean matches=source.owner.id.equals(id);for(Tile t:source.mirrors)matches|=t.id.equals(id);if(matches){source.close();entries.remove();retryAt.remove(e.getKey());}}}
 void close(){stopped=true;if(recording.active())recording.stop(true,null);else clearCaptureAuxiliary();dismissPlayback();for(Source s:sources.values())s.close();sources.clear();layer.removeAllViews();tiles.clear();}
}
