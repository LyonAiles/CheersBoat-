package fr.nautic.test;

final class CameraStreamPolicy {
 static String preview(String path,boolean mobile,boolean tapo){
  if(mobile)return "/stream7";
  if(tapo&&"/stream1".equals(path))return "/stream2";
  if(tapo&&"/stream6".equals(path))return "/stream7";
  return path==null||path.isEmpty()?"/stream1":path;
 }
}
