package fr.nautic.test;
import org.junit.Test;
import static org.junit.Assert.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
public class NotesDocumentTest {
 static class Draft implements NotesDocument.Store {String text="Écluse\nTéléphoner demain";public String read(){return text;}public void save(String s){text=s;}}
 @Test public void exportsUtf8BeforeClearingDraft()throws Exception{Draft d=new Draft();String snapshot=d.text;ByteArrayOutputStream file=new ByteArrayOutputStream();NotesDocument.export(file,snapshot,d);assertEquals(snapshot,new String(file.toByteArray(),StandardCharsets.UTF_8));assertEquals("",d.text);}
 @Test public void failedWriteOrClosePreservesDraft()throws Exception{for(boolean close:new boolean[]{false,true}){Draft d=new Draft();String original=d.text;OutputStream file=new OutputStream(){public void write(int b)throws IOException{if(!close)throw new IOException("write failed");}public void close()throws IOException{if(close)throw new IOException("close failed");}};try{NotesDocument.export(file,original,d);fail();}catch(IOException expected){}assertEquals(original,d.text);}}
 @Test public void editsMadeAfterSnapshotAreNotErased()throws Exception{Draft d=new Draft();String snapshot=d.text;d.text+="\nNouvelle note";NotesDocument.export(new ByteArrayOutputStream(),snapshot,d);assertTrue(d.text.endsWith("Nouvelle note"));}
}
