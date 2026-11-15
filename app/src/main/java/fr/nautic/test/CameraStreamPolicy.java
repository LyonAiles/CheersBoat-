package fr.nautic.test;

final class CameraStreamPolicy {
 static boolean hasTapoQualityPair(String path){
  return "/stream1".equals(path)||"/stream2".equals(path)||"/stream6".equals(path)||"/stream7".equals(path);
 }
 static String viewingQuality(String path,boolean light){
  if(!hasTapoQualityPair(path))return path;
  return "/stream6".equals(path)||"/stream7".equals(path)?(light?"/stream7":"/stream6"):(light?"/stream2":"/stream1");
 }
 static String preview(String path,boolean mobile,boolean tapo){
  if(mobile)return "/stream7";
  if(tapo&&"/stream1".equals(path))return "/stream2";
  if(tapo&&"/stream6".equals(path))return "/stream7";
  return path==null||path.isEmpty()?"/stream1":path;
 }
}
