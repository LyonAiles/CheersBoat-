package fr.nautic.test;

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
 final Map<String,Tile> tiles=new LinkedHashMap<>();
 final Map<String,Source> sources=new LinkedHashMap<>();
 final Map<String,Long> retryAt=new HashMap<>();
 int decoderBudget=4;
 boolean stopped=false,mapPaused=false;
 void pauseForMap(boolean paused){
  if(mapPaused==paused)return;mapPaused=paused;
  if(paused){for(Source source:sources.values())source.close();sources.clear();for(Tile tile:tiles.values())tile.message.setText("Image figée · carte");}
  for(Tile tile:tiles.values()){tile.garland.setPaused(paused);if(paused)tile.beacon.clearAnimation();else if(tile.alarm)tile.alarm=false;}
 }

 class Tile{
  final String id;final FrameLayout frame;final ImageView mirror;final TextView message,banner,footer,beacon;
  boolean alarm=false,active=false;
  final CameraGarland garland=new CameraGarland(activity.getResources().getDisplayMetrics().density);
  int dp(float n){return (int)(n*activity.getResources().getDisplayMetrics().density+.5f);}
  TextView overlay(int size){TextView t=new TextView(activity);t.setTextColor(Color.WHITE);t.setTextSize(size);t.setGravity(Gravity.CENTER);t.setPadding(dp(4),dp(3),dp(4),dp(3));t.setBackgroundColor(0xb3075e9f);return t;}
  Tile(String id){this.id=id;frame=new FrameLayout(activity);frame.setBackgroundColor(Color.BLACK);
   android.graphics.drawable.GradientDrawable shape=new android.graphics.drawable.GradientDrawable();shape.setColor(Color.BLACK);shape.setCornerRadius(dp(8));frame.setBackground(shape);frame.setClipToOutline(true);
   mirror=new ImageView(activity);mirror.setScaleType(ImageView.ScaleType.CENTER_CROP);frame.addView(mirror,new FrameLayout.LayoutParams(-1,-1));
   message=new TextView(activity);message.setTextColor(Color.WHITE);message.setTextSize(10);message.setGravity(Gravity.CENTER);frame.addView(message,new FrameLayout.LayoutParams(-1,-1));
   banner=overlay(11);banner.setSingleLine(true);banner.setEllipsize(android.text.TextUtils.TruncateAt.END);frame.addView(banner,new FrameLayout.LayoutParams(-1,-2,Gravity.TOP));
   footer=overlay(10);footer.setMaxLines(2);frame.addView(footer,new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM));footer.setVisibility(View.GONE);
   beacon=overlay(42);beacon.setText("⚠");beacon.setBackgroundColor(0xe6e00000);beacon.setVisibility(View.GONE);frame.addView(beacon,new FrameLayout.LayoutParams(dp(70),dp(66),Gravity.CENTER));
   TextView refresh=overlay(20);refresh.setText("↻");refresh.setContentDescription("Rafraîchir cette caméra");frame.addView(refresh,new FrameLayout.LayoutParams(dp(30),dp(30),Gravity.TOP|Gravity.RIGHT));refresh.setOnClickListener(v->{refreshTile(id);activity.refreshDashboardVideos();});
   frame.setOnClickListener(v->activity.dashboardClick(id,false));frame.setOnLongClickListener(v->{activity.dashboardClick(id,true);return true;});layer.addView(frame);
  }
  void decorate(JSONObject data){
   active=data.optBoolean("active",false);
   banner.setText((data.optString("number","").isEmpty()?"":data.optString("number")+" · ")+data.optString("label","📷"));footer.setText(data.optString("status",""));footer.setVisibility(footer.length()==0?View.GONE:View.VISIBLE);
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
  Bitmap last;
  volatile long lastFrame=0;
  final long created=System.currentTimeMillis();
  boolean failed=false;
  Source(String uri,Tile owner){this.owner=owner;texture=new TextureView(activity);owner.frame.addView(texture,0,new FrameLayout.LayoutParams(-1,-1));
   owner.mirror.setImageDrawable(null);
   player=new ExoPlayer.Builder(activity,new DefaultRenderersFactory(activity).setEnableDecoderFallback(true)).build();player.setVolume(0);player.setVideoTextureView(texture);
   player.setVideoFrameMetadataListener((presentationTimeUs,releaseTimeNs,format,mediaFormat)->lastFrame=System.currentTimeMillis());
   player.addListener(new Player.Listener(){
    @Override public void onRenderedFirstFrame(){owner.message.setText("");}
    @Override public void onPlayerError(PlaybackException e){
     failed=true;retryAt.put(uri,System.currentTimeMillis()+4000);
     if(e.getErrorCodeName().contains("DECOD"))decoderBudget=Math.max(1,Math.min(decoderBudget,sources.size()-1));
     owner.message.setText("Relance · "+e.getErrorCodeName());for(Tile t:mirrors)t.message.setText(owner.message.getText());
    }
    @Override public void onVideoSizeChanged(VideoSize size){texture.post(()->{
     if(size.width==0||size.height==0||texture.getWidth()==0||texture.getHeight()==0)return;
     float sourceRatio=(float)size.width*size.pixelWidthHeightRatio/size.height,viewRatio=(float)texture.getWidth()/texture.getHeight();
     Matrix m=new Matrix();m.setScale(sourceRatio>viewRatio?sourceRatio/viewRatio:1,sourceRatio<viewRatio?viewRatio/sourceRatio:1,texture.getWidth()/2f,texture.getHeight()/2f);texture.setTransform(m);
    });}
   });
   player.setMediaSource(new RtspMediaSource.Factory().setForceUseRtpTcp(true).createMediaSource(MediaItem.fromUri(uri)));player.prepare();player.play();
  }
  void close(){
   if(!stopped&&texture.isAvailable()&&lastFrame>0){Bitmap snapshot=texture.getBitmap(320,200);if(snapshot!=null){owner.mirror.setImageBitmap(snapshot);for(Tile t:mirrors)t.mirror.setImageBitmap(snapshot);owner.message.setText("Dernière image · actualisation…");}}
   player.release();owner.frame.removeView(texture);last=null;
  }
  void copy(){if(mirrors.isEmpty()||!texture.isAvailable())return;Bitmap next=texture.getBitmap(320,200);if(next==null)return;for(Tile t:mirrors){t.mirror.setImageBitmap(next);t.message.setText(owner.message.getText());}last=next;}
 }
 DashboardCameras(MainActivity activity,FrameLayout layer){this.activity=activity;this.layer=layer;}
 void update(String json){
  if(stopped||mapPaused)return;
  try{
   JSONObject data=new JSONObject(json);JSONArray list=data.getJSONArray("tiles");double width=data.getDouble("width");if(width<=0)return;double scale=layer.getWidth()/width;
   Set<String> visible=new HashSet<>();Map<String,List<Tile>> grouped=new LinkedHashMap<>();
   for(int i=0;i<list.length();i++){
    JSONObject item=list.getJSONObject(i);String id=item.getString("id");if(!id.matches("cam[123]Body|trematagePreview"))continue;
    visible.add(id);Tile tile=tiles.get(id);if(tile==null){tile=new Tile(id);tiles.put(id,tile);}
    FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(Math.max(1,(int)(item.getDouble("w")*scale)),Math.max(1,(int)(item.getDouble("h")*scale)));lp.leftMargin=(int)(item.getDouble("x")*scale);lp.topMargin=(int)(item.getDouble("y")*scale);tile.frame.setLayoutParams(lp);tile.frame.setVisibility(View.VISIBLE);
    tile.decorate(item);
    boolean mobile=id.equals("trematagePreview");int index=mobile?TrematageAccess.index(activity):CameraDisplaySource.index(activity,id.charAt(3)-'0');
    String url=TrematageAccess.address(activity,index);
    if(!url.startsWith("rtsp://")){tile.message.setText("📷");continue;}
    Uri uri=Uri.parse(url);android.content.SharedPreferences p=activity.getSharedPreferences("nautic_camera_private",0);
    String user=p.getString("username"+index,p.getString("username","")),pass=p.getString("password"+index,p.getString("password",""));
    if(user.isEmpty()){tile.message.setText("⚙ Identifiants caméra");continue;}
    String tapoHost=Uri.parse(TrematageAccess.address(activity,TrematageAccess.index(activity))).getHost();
    String path=CameraStreamPolicy.preview(uri.getPath(),mobile,index==1||java.util.Objects.equals(tapoHost,uri.getHost()));
    String stream="rtsp://"+Uri.encode(user)+":"+Uri.encode(pass)+"@"+uri.getHost()+":"+(uri.getPort()>0?uri.getPort():554)+path;
    if(!grouped.containsKey(stream))grouped.put(stream,new ArrayList<>());grouped.get(stream).add(tile);
   }
   for(Tile t:tiles.values())if(!visible.contains(t.id))t.frame.setVisibility(View.GONE);
   long now=System.currentTimeMillis();
   List<String> eligible=new ArrayList<>();String priority=null;
   for(Map.Entry<String,List<Tile>> e:grouped.entrySet()){
    if(retryAt.containsKey(e.getKey())&&retryAt.get(e.getKey())>now)continue;
    eligible.add(e.getKey());for(Tile tile:e.getValue())if(tile.id.equals("trematagePreview")&&tile.active)priority=e.getKey();
   }
   Set<String> selected=new HashSet<>();if(priority!=null){selected.add(priority);eligible.remove(priority);}
   int start=eligible.isEmpty()?0:(int)((now/8000)%eligible.size());
   for(int i=0;i<eligible.size()&&selected.size()<decoderBudget;i++)selected.add(eligible.get((start+i)%eligible.size()));
   Iterator<Map.Entry<String,Source>> iterator=sources.entrySet().iterator();while(iterator.hasNext()){
    Map.Entry<String,Source> entry=iterator.next();List<Tile> group=grouped.get(entry.getKey());
    Source source=entry.getValue();
    boolean stalled=now-(source.lastFrame==0?source.created:source.lastFrame)>(source.lastFrame==0?14000:9000);
    if(stalled)retryAt.put(entry.getKey(),now+2000);
    if(group==null||!group.contains(source.owner)||!selected.contains(entry.getKey())||source.failed||stalled){source.close();iterator.remove();if(stalled||source.failed)selected.remove(entry.getKey());}
   }
   for(Map.Entry<String,List<Tile>> e:grouped.entrySet()){
    if(!selected.contains(e.getKey()))continue;
    Source source=sources.get(e.getKey());if(source==null){Tile owner=e.getValue().get(0);owner.message.setText("◌");source=new Source(e.getKey(),owner);sources.put(e.getKey(),source);}
    source.mirrors.clear();for(Tile t:e.getValue())if(t!=source.owner)source.mirrors.add(t);source.copy();
   }
  }catch(Exception ignored){}
 }
 void refreshTile(String id){Iterator<Map.Entry<String,Source>> entries=sources.entrySet().iterator();while(entries.hasNext()){Map.Entry<String,Source> e=entries.next();Source source=e.getValue();boolean matches=source.owner.id.equals(id);for(Tile t:source.mirrors)matches|=t.id.equals(id);if(matches){source.close();entries.remove();retryAt.remove(e.getKey());}}}
 void close(){stopped=true;for(Source s:sources.values())s.close();sources.clear();layer.removeAllViews();tiles.clear();}
}
