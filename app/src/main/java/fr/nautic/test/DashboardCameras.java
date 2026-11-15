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
 int draggingCamera;
 final Map<String,Tile> tiles=new LinkedHashMap<>();
 final Map<String,Source> sources=new LinkedHashMap<>();
 final Map<String,Long> retryAt=new HashMap<>();
 final Map<String,String> failures=new HashMap<>();
 final Set<String> useConfiguredStream=new HashSet<>();
 int decoderBudget=4;
 float mapAlpha=1;
 TextView cameraSwitch;
 boolean adjustingMapAlpha;
 static boolean isMapView(String id){return id.startsWith("mapCamera");}
 void setMapAlpha(float value){
  mapAlpha=value;
  for(Tile tile:tiles.values())if(isMapView(tile.id))tile.frame.setAlpha(value);
 }
 boolean stopped=false,mapPaused=false,suspended=false;
 void suspend(){
  if(stopped||suspended)return;
  suspended=true;
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
  if(paused){freezeSources();for(Tile tile:tiles.values())if(tile.snapshot==null)tile.message.setText("Image figée · carte");}
  for(Tile tile:tiles.values()){tile.garland.setPaused(paused);if(paused)tile.beacon.clearAnimation();else if(tile.alarm)tile.alarm=false;}
 }

 class Tile{
  final String id;final FrameLayout frame;final ImageView mirror;final TextView message,banner,footer,beacon;
  boolean alarm=false,active=false;
  int displayedCamera=0,displayedLens=0,cropCamera=0;
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
   if(isMapView(id)){
    if(!id.equals("mapCameraPreview")){
     frame.setOutlineProvider(new ViewOutlineProvider(){
      @Override public void getOutline(View view,Outline outline){outline.setOval(0,0,view.getWidth(),view.getHeight());}
     });
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
   frame.setOnClickListener(v->activity.dashboardClick(id,false));frame.setOnLongClickListener(v->{activity.dashboardClick(id,true);return true;});layer.addView(frame);
  }
  void setSnapshot(Bitmap bitmap){
   snapshot=bitmap;
   mirror.setImageBitmap(bitmap);
   applyCrop();
  }
  void applyCrop(){
   int width=frame.getWidth(),height=frame.getHeight();
   if(width<=0||height<=0)return;
   CameraCrop crop=CameraCrop.supported(cropCamera)?crops[cropCamera]:CameraCrop.CENTER;
   if(source!=null){
    float ratio=source.videoRatio/((float)width/height);
    float sx=Math.max(1,ratio),sy=Math.max(1,1/ratio);
    source.texture.setScaleX(sx);source.texture.setScaleY(sy);
    source.texture.setTranslationX(crop.translateX(width*(sx-1)));
    source.texture.setTranslationY(crop.translateY(height*(sy-1)));
   }
   if(snapshot!=null){
    float scale=Math.max((float)width/snapshot.getWidth(),(float)height/snapshot.getHeight());
    float extraX=snapshot.getWidth()*scale-width,extraY=snapshot.getHeight()*scale-height;
    Matrix matrix=new Matrix();
    matrix.setScale(scale,scale);
    matrix.postTranslate(-extraX/2+crop.translateX(extraX),-extraY/2+crop.translateY(extraY));
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
  void installTransparencyGesture(){
   frame.setOnTouchListener(new View.OnTouchListener(){
    float startY,startAlpha;
    boolean center,dragged;
    @Override public boolean onTouch(View view,MotionEvent event){
     switch(event.getActionMasked()){
      case MotionEvent.ACTION_DOWN:
       center=Math.abs(event.getX()-view.getWidth()/2f)<=view.getWidth()/6f;
       startY=event.getRawY();
       startAlpha=mapAlpha;
       dragged=false;
       return true;
      case MotionEvent.ACTION_MOVE:
       float delta=event.getRawY()-startY;
       if(center&&(dragged||Math.abs(delta)>ViewConfiguration.get(activity).getScaledTouchSlop())){
        dragged=true;
        adjustingMapAlpha=true;
        setMapAlpha(Math.max(.15f,Math.min(1f,startAlpha+delta/view.getHeight())));
       }
       return true;
      case MotionEvent.ACTION_UP:
       if(!dragged)view.performClick();
       // Keep the native and web previews at the same opacity.
       if(dragged)activity.updateMapCameraAlpha(mapAlpha);
       adjustingMapAlpha=false;
       return true;
      case MotionEvent.ACTION_CANCEL:
       if(dragged)activity.updateMapCameraAlpha(mapAlpha);
       adjustingMapAlpha=false;
       return true;
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
  final ExoPlayer player;final TextureView texture;final Tile owner;final List<Tile> mirrors=new ArrayList<>();
  float videoRatio=16f/9f;
  volatile long lastFrame=0;
  final long created=System.currentTimeMillis();
  boolean failed=false;
  Source(String uri,Tile owner){
   this.owner=owner;texture=new TextureView(activity);
   player=new ExoPlayer.Builder(activity,new DefaultRenderersFactory(activity).setEnableDecoderFallback(true)).build();
   owner.frame.addView(texture,0,new FrameLayout.LayoutParams(-1,-1));
   owner.source=this;
   try{
   owner.applyCrop();player.setVolume(0);player.setVideoTextureView(texture);
   player.setVideoFrameMetadataListener((presentationTimeUs,releaseTimeNs,format,mediaFormat)->lastFrame=System.currentTimeMillis());
   player.addListener(new Player.Listener(){
    @Override public void onRenderedFirstFrame(){
     if(owner.source!=Source.this)return;
     failures.remove(uri);
     owner.setSnapshot(null);
     owner.message.setText("");
    }
    @Override public void onPlayerError(PlaybackException e){
     failed=true;retryAt.put(uri,System.currentTimeMillis()+4000);
     if(e.getErrorCodeName().contains("DECOD"))decoderBudget=Math.max(1,Math.min(decoderBudget,sources.size()-1));
     else if(lastFrame==0)useConfiguredStream.add(uri);
     String message=e.getErrorCodeName().replace("ERROR_CODE_","");
     failures.put(uri,message);
     owner.message.setText(message);
     for(Tile tile:mirrors)tile.message.setText(message);
    }
    @Override public void onVideoSizeChanged(VideoSize size){
     if(size.width<=0||size.height<=0||size.pixelWidthHeightRatio<=0)return;
     videoRatio=size.width*size.pixelWidthHeightRatio/size.height;
     owner.applyCrop();
    }
   });
   player.setMediaSource(new RtspMediaSource.Factory().setForceUseRtpTcp(true).createMediaSource(MediaItem.fromUri(uri)));player.prepare();player.play();
   }catch(RuntimeException e){
    player.release();owner.frame.removeView(texture);owner.source=null;
    throw e;
   }
  }
  Bitmap capture(){
   if(!texture.isAvailable()||lastFrame==0)return null;
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
   for(Tile tile:mirrors){tile.setSnapshot(snapshot);tile.message.setText(owner.message.getText());}
  }
 }
 DashboardCameras(MainActivity activity,FrameLayout layer){
  this.activity=activity;this.layer=layer;
  settings=activity.getSharedPreferences("nautic_settings",MainActivity.MODE_PRIVATE);
  for(int camera=1;camera<=3;camera++)crops[camera]=CameraCrop.read(settings.getString(CameraCrop.key(camera),""));
 }
 void applyCameraCrop(int camera,CameraCrop crop){
  crops[camera]=crop;
  for(Tile tile:tiles.values())if(tile.cropCamera==camera)tile.applyCrop();
 }
 void update(String json){
  if(stopped||mapPaused||suspended)return;
  try{
   JSONObject data=new JSONObject(json);JSONArray list=data.getJSONArray("tiles");double width=data.getDouble("width");if(width<=0)return;double scale=layer.getWidth()/width;
   for(int camera=1;camera<=3;camera++)if(camera!=draggingCamera){
    applyCameraCrop(camera,CameraCrop.read(settings.getString(CameraCrop.key(camera),"")));
   }
   if(!adjustingMapAlpha)setMapAlpha((float)data.optDouble("mapCameraAlpha",1));
   if(scale<=0)return;
   Set<String> visible=new HashSet<>();Map<String,List<Tile>> grouped=new LinkedHashMap<>();
   Set<Tile> changedFeeds=new HashSet<>();
   for(int i=0;i<list.length();i++){
    JSONObject item=list.getJSONObject(i);String id=item.getString("id");if(!id.matches("cam[123]Body|trematagePreview|mapCameraPreview|mapCameraPort|mapCameraStarboard"))continue;
    visible.add(id);Tile tile=tiles.get(id);if(tile==null){tile=new Tile(id);tiles.put(id,tile);}
    FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(Math.max(1,(int)(item.getDouble("w")*scale)),Math.max(1,(int)(item.getDouble("h")*scale)));lp.leftMargin=(int)(item.getDouble("x")*scale);lp.topMargin=(int)(item.getDouble("y")*scale);tile.frame.setLayoutParams(lp);tile.frame.setVisibility(View.VISIBLE);
    boolean inMap=isMapView(id);
    if(inMap){tile.frame.setAlpha(mapAlpha);tile.frame.bringToFront();}
    if(!inMap)tile.decorate(item);
    boolean mobile=id.equals("trematagePreview");
    int index=inMap?item.optInt("camera",2):mobile?TrematageAccess.index(activity):CameraDisplaySource.index(activity,id.charAt(3)-'0');
    tile.cropCamera=inMap?index:mobile?0:id.charAt(3)-'0';
    tile.applyCrop();
    int lens=inMap?item.optInt("lens",index==2?2:0):0;
    if(inMap){
     if(index<1||index>3)continue;
     if(tile.displayedCamera!=index||tile.displayedLens!=lens){
      changedFeeds.add(tile);tile.displayedCamera=index;tile.displayedLens=lens;
     }
     String number=item.optString("number","");
     tile.banner.setText(number.isEmpty()?"":number+" · "+(40+index));
     tile.banner.setVisibility(number.isEmpty()?View.GONE:View.VISIBLE);
     String action=id.equals("mapCameraPreview")?"":" · toucher pour échanger, glisser pour recadrer";
     tile.frame.setContentDescription("Caméra "+(40+index)+action);
    }
    try{
    String url=TrematageAccess.address(activity,index).trim();
    if(url.isEmpty()){tile.message.setText("Adresse caméra manquante");continue;}
    if(!url.regionMatches(true,0,"rtsp://",0,7)){tile.message.setText("Adresse RTSP non reconnue");continue;}
    Uri uri=Uri.parse(url);android.content.SharedPreferences p=activity.getSharedPreferences("nautic_camera_private",0);
    String user=p.getString("username"+index,p.getString("username","")),pass=p.getString("password"+index,p.getString("password",""));
    if(uri.getHost()==null){tile.message.setText("Adresse caméra invalide");continue;}
    String embedded=uri.getUserInfo();
    if(user.isEmpty()&&embedded!=null){
     int separator=embedded.indexOf(':');
     user=separator<0?embedded:embedded.substring(0,separator);
     pass=separator<0?"":embedded.substring(separator+1);
    }
    String tapoHost=Uri.parse(TrematageAccess.address(activity,TrematageAccess.index(activity))).getHost();
    String path=uri.getEncodedPath();
    if(lens!=0)path=lens==1?"/stream6":"/stream1";
    String preferredPath=CameraStreamPolicy.preview(path,mobile,lens!=0||index==1||java.util.Objects.equals(tapoHost,uri.getHost()));
    String auth=user.isEmpty()?"":Uri.encode(user)+":"+Uri.encode(pass)+"@";
    String host=uri.getHost();
    if(host.contains(":")&&!host.startsWith("["))host="["+host+"]";
    String base="rtsp://"+auth+host+":"+(uri.getPort()>0?uri.getPort():554);
    String query=uri.getEncodedQuery();
    String suffix=query==null?"":"?"+query;
    String preferred=base+preferredPath+suffix;
    String stream=!mobile&&path!=null&&!path.isEmpty()&&useConfiguredStream.contains(preferred)
     ?base+path+suffix:preferred;
    List<Tile> group=grouped.computeIfAbsent(stream,key->new ArrayList<>());
    if(id.equals("mapCameraPreview"))group.add(0,tile);else group.add(tile);
    }catch(Exception e){tile.message.setText("Réglages caméra illisibles");}
   }
   for(Tile t:tiles.values())if(!visible.contains(t.id))t.frame.setVisibility(View.GONE);
   updateCameraSwitch(data.optJSONObject("switchButton"),scale);
   long now=System.currentTimeMillis();
   List<String> eligible=new ArrayList<>();String priority=null;
   for(Map.Entry<String,List<Tile>> e:grouped.entrySet()){
    if(retryAt.getOrDefault(e.getKey(),0L)>now){
     String message=failures.get(e.getKey());
     if(message!=null)for(Tile tile:e.getValue())tile.message.setText(message);
     continue;
    }
    eligible.add(e.getKey());for(Tile tile:e.getValue())if(tile.id.equals("mapCameraPreview")||(priority==null&&tile.id.equals("trematagePreview")&&tile.active))priority=e.getKey();
   }
   Set<String> selected=new HashSet<>();if(priority!=null){selected.add(priority);eligible.remove(priority);}
   int start=eligible.isEmpty()?0:(int)((now/8000)%eligible.size());
   for(int i=0;i<eligible.size()&&selected.size()<decoderBudget;i++)selected.add(eligible.get((start+i)%eligible.size()));
   Iterator<Map.Entry<String,Source>> iterator=sources.entrySet().iterator();while(iterator.hasNext()){
    Map.Entry<String,Source> entry=iterator.next();List<Tile> group=grouped.get(entry.getKey());
    Source source=entry.getValue();
    boolean stalled=now-(source.lastFrame==0?source.created:source.lastFrame)>(source.lastFrame==0?14000:9000);
    if(stalled){
     retryAt.put(entry.getKey(),now+2000);
     failures.put(entry.getKey(),"Flux sans image");
     if(source.lastFrame==0)useConfiguredStream.add(entry.getKey());
    }
    if(group==null||group.get(0)!=source.owner||!selected.contains(entry.getKey())||source.failed||stalled){source.close();iterator.remove();if(stalled||source.failed)selected.remove(entry.getKey());}
   }
   for(Tile tile:changedFeeds){tile.setSnapshot(null);}
   for(Map.Entry<String,List<Tile>> e:grouped.entrySet()){
    if(!selected.contains(e.getKey()))continue;
    Source source=sources.get(e.getKey());
    if(source==null){
     Tile owner=e.getValue().get(0);
     owner.message.setText(failures.getOrDefault(e.getKey(),owner.snapshot==null?"Connexion…":""));
     try{
      source=new Source(e.getKey(),owner);sources.put(e.getKey(),source);
     }catch(RuntimeException error){
      retryAt.put(e.getKey(),now+4000);
      failures.put(e.getKey(),"Lecteur vidéo indisponible");
      for(Tile tile:e.getValue())tile.message.setText("Lecteur vidéo indisponible");
      continue;
     }
    }
    source.mirrors.clear();for(Tile t:e.getValue())if(t!=source.owner)source.mirrors.add(t);source.copy();
   }
  }catch(Exception ignored){}
 }
 void updateCameraSwitch(JSONObject bounds,double scale){
  if(bounds==null){
   if(cameraSwitch!=null)cameraSwitch.setVisibility(View.GONE);
   return;
  }
  if(cameraSwitch==null){
   cameraSwitch=new TextView(activity);
   cameraSwitch.setText("⇄");
   cameraSwitch.setTextSize(20);
   cameraSwitch.setTextColor(Color.WHITE);
   cameraSwitch.setGravity(Gravity.CENTER);
   cameraSwitch.setContentDescription("Changer l’objectif central");
   android.graphics.drawable.GradientDrawable background=new android.graphics.drawable.GradientDrawable();
   background.setShape(android.graphics.drawable.GradientDrawable.OVAL);
   background.setColor(0xc0123b4d);
   cameraSwitch.setBackground(background);
   cameraSwitch.setOnClickListener(v->activity.dashboardClick("mapCameraSwitch",false));
   layer.addView(cameraSwitch);
  }
  FrameLayout.LayoutParams layout=new FrameLayout.LayoutParams(
   Math.max(1,(int)(bounds.optDouble("w")*scale)),Math.max(1,(int)(bounds.optDouble("h")*scale)));
  layout.leftMargin=(int)(bounds.optDouble("x")*scale);
  layout.topMargin=(int)(bounds.optDouble("y")*scale);
  String number=bounds.optString("number","");
  cameraSwitch.setText(number.isEmpty()?"⇄":"⇄ "+number);
  cameraSwitch.setTextSize(number.isEmpty()?20:13);
  cameraSwitch.setLayoutParams(layout);
  cameraSwitch.setVisibility(View.VISIBLE);
  cameraSwitch.bringToFront();
 }
 void refreshTile(String id){Iterator<Map.Entry<String,Source>> entries=sources.entrySet().iterator();while(entries.hasNext()){Map.Entry<String,Source> e=entries.next();Source source=e.getValue();boolean matches=source.owner.id.equals(id);for(Tile t:source.mirrors)matches|=t.id.equals(id);if(matches){source.close();entries.remove();retryAt.remove(e.getKey());}}}
 void close(){stopped=true;for(Source s:sources.values())s.close();sources.clear();layer.removeAllViews();tiles.clear();}
}
