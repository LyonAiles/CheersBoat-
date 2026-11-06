package fr.nautic.test;
import java.io.*;
import java.nio.charset.StandardCharsets;

final class NotesDocument {
 interface Store {String read();void save(String value)throws IOException;}
 static void export(OutputStream output,String snapshot,Store store)throws IOException{
  if(output==null)throw new IOException("Fichier inaccessible");
  try(OutputStream target=output){target.write(snapshot.getBytes(StandardCharsets.UTF_8));target.flush();}
  // A failed write/close or newer edits must never erase the draft.
  if(store.read().equals(snapshot))store.save("");
 }
}
