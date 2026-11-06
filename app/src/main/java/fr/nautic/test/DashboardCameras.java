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
 boolean stopped=false;
 class Tile{
  final String id;final FrameLayout frame;final ImageView mirror;final TextView message;
  Tile(String id){this.id=id;frame=new FrameLayout(activity);frame.setBackgroundColor(Color.BLACK);
   mirror=new ImageView(activity);mirror.setScaleType(ImageView.ScaleType.FIT_CENTER);frame.addView(mirror,new FrameLayout.LayoutParams(-1,-1));
   message=new TextView(activity);message.setTextColor(Color.WHITE);message.setTextSize(10);message.setGravity(Gravity.CENTER);frame.addView(message,new FrameLayout.LayoutParams(-1,-1));
   frame.setOnClickListener(v->activity.dashboardClick(id,false));frame.setOnLongClickListener(v->{activity.dashboardClick(id,true);return true;});layer.addView(frame);
  }
 }
 class Source{
  final ExoPlayer player;final TextureView texture;final Tile owner;final List<Tile> mirrors=new ArrayList<>();
  Bitmap last;
  Source(String uri,Tile owner){this.owner=owner;texture=new TextureView(activity);owner.frame.addView(texture,0,new FrameLayout.LayoutParams(-1,-1));
   player=new ExoPlayer.Builder(activity,new DefaultRenderersFactory(activity).setEnableDecoderFallback(true)).build();player.setVolume(0);player.setVideoTextureView(texture);
   player.addListener(new Player.Listener(){
    @Override public void onRenderedFirstFrame(){owner.message.setText("");}
    @Override public void onPlayerError(PlaybackException e){owner.message.setText("⚠ Flux indisponible");for(Tile t:mirrors)t.message.setText("⚠ Flux indisponible");}
    @Override public void onVideoSizeChanged(VideoSize size){texture.post(()->{
     if(size.width==0||size.height==0||texture.getWidth()==0||texture.getHeight()==0)return;
     float sourceRatio=(float)size.width*size.pixelWidthHeightRatio/size.height,viewRatio=(float)texture.getWidth()/texture.getHeight();
     Matrix m=new Matrix();m.setScale(sourceRatio<viewRatio?sourceRatio/viewRatio:1,sourceRatio>viewRatio?viewRatio/sourceRatio:1,texture.getWidth()/2f,texture.getHeight()/2f);texture.setTransform(m);
    });}
   });
   player.setMediaSource(new RtspMediaSource.Factory().setForceUseRtpTcp(true).createMediaSource(MediaItem.fromUri(uri)));player.prepare();player.play();
  }
  void close(){player.release();owner.frame.removeView(texture);for(Tile t:mirrors)t.mirror.setImageDrawable(null);if(last!=null)last.recycle();}
  void copy(){if(mirrors.isEmpty()||!texture.isAvailable())return;Bitmap next=texture.getBitmap(240,150);if(next==null)return;for(Tile t:mirrors){t.mirror.setImageBitmap(next);t.message.setText(owner.message.getText());}Bitmap old=last;last=next;if(old!=null)old.recycle();}
 }
 DashboardCameras(MainActivity activity,FrameLayout layer){this.activity=activity;this.layer=layer;}
 void update(String json){
  if(stopped)return;
  try{
   JSONObject data=new JSONObject(json);JSONArray list=data.getJSONArray("tiles");double width=data.getDouble("width");if(width<=0)return;double scale=layer.getWidth()/width;
   Set<String> visible=new HashSet<>();Map<String,List<Tile>> grouped=new LinkedHashMap<>();
   for(int i=0;i<list.length();i++){
    JSONObject item=list.getJSONObject(i);String id=item.getString("id");if(!id.matches("cam[123]Body|trematagePreview"))continue;
    visible.add(id);Tile tile=tiles.get(id);if(tile==null){tile=new Tile(id);tiles.put(id,tile);}
    FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(Math.max(1,(int)(item.getDouble("w")*scale)),Math.max(1,(int)(item.getDouble("h")*scale)));lp.leftMargin=(int)(item.getDouble("x")*scale);lp.topMargin=(int)(item.getDouble("y")*scale);tile.frame.setLayoutParams(lp);tile.frame.setVisibility(View.VISIBLE);
    boolean mobile=id.equals("trematagePreview");int index=mobile?TrematageAccess.index(activity):id.charAt(3)-'0';
    String url=TrematageAccess.address(activity,index);
    if(!url.startsWith("rtsp://")){tile.message.setText("📷");continue;}
    Uri uri=Uri.parse(url);android.content.SharedPreferences p=activity.getSharedPreferences("nautic_camera_private",0);
    String user=p.getString("username"+index,p.getString("username","")),pass=p.getString("password"+index,p.getString("password",""));
    if(user.isEmpty()){tile.message.setText("⚙ Identifiants caméra");continue;}
    String path=mobile?"/stream6":uri.getPath();if(path==null||path.isEmpty())path="/stream1";
    String stream="rtsp://"+Uri.encode(user)+":"+Uri.encode(pass)+"@"+uri.getHost()+":"+(uri.getPort()>0?uri.getPort():554)+path;
    if(!grouped.containsKey(stream))grouped.put(stream,new ArrayList<>());grouped.get(stream).add(tile);
   }
   for(Tile t:tiles.values())if(!visible.contains(t.id))t.frame.setVisibility(View.GONE);
   Iterator<Map.Entry<String,Source>> iterator=sources.entrySet().iterator();while(iterator.hasNext()){
    Map.Entry<String,Source> entry=iterator.next();List<Tile> group=grouped.get(entry.getKey());
    if(group==null||!group.contains(entry.getValue().owner)){entry.getValue().close();iterator.remove();}
   }
   for(Map.Entry<String,List<Tile>> e:grouped.entrySet()){
    Source source=sources.get(e.getKey());if(source==null){Tile owner=e.getValue().get(0);owner.message.setText("◌");source=new Source(e.getKey(),owner);sources.put(e.getKey(),source);}
    source.mirrors.clear();for(Tile t:e.getValue())if(t!=source.owner)source.mirrors.add(t);source.copy();
   }
  }catch(Exception ignored){}
 }
 void close(){stopped=true;for(Source s:sources.values())s.close();sources.clear();layer.removeAllViews();tiles.clear();}
}
