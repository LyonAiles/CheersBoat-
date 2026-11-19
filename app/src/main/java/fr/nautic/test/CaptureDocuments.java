package fr.nautic.test;

import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import android.provider.DocumentsContract.Root;
import android.provider.DocumentsProvider;
import java.io.File;
import java.io.FileNotFoundException;

/** Read-only access to Nautic captures through the Android system file picker. */
public final class CaptureDocuments extends DocumentsProvider {
 private static final String DIRECTORY="captures";
 private static final String TITLE="Captures Nautic";
 private static final String[] ROOT_COLUMNS={Root.COLUMN_ROOT_ID,Root.COLUMN_DOCUMENT_ID,
  Root.COLUMN_TITLE,Root.COLUMN_FLAGS,Root.COLUMN_ICON,Root.COLUMN_MIME_TYPES};
 private static final String[] DOCUMENT_COLUMNS={Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,
  Document.COLUMN_MIME_TYPE,Document.COLUMN_SIZE,Document.COLUMN_LAST_MODIFIED,Document.COLUMN_FLAGS};

 static Uri directoryUri(Context context){
  return DocumentsContract.buildDocumentUri(context.getPackageName()+".captures",DIRECTORY);
 }

 @Override public boolean onCreate(){return true;}

 @Override public Cursor queryRoots(String[] projection){
  MatrixCursor cursor=new MatrixCursor(projection==null?ROOT_COLUMNS:projection);
  MatrixCursor.RowBuilder row=cursor.newRow();
  row.add(Root.COLUMN_ROOT_ID,DIRECTORY).add(Root.COLUMN_DOCUMENT_ID,DIRECTORY)
   .add(Root.COLUMN_TITLE,TITLE).add(Root.COLUMN_FLAGS,0)
   .add(Root.COLUMN_ICON,android.R.drawable.ic_menu_camera)
   .add(Root.COLUMN_MIME_TYPES,"image/jpeg\nvideo/mp4");
  return cursor;
 }

 @Override public Cursor queryDocument(String id,String[] projection)throws FileNotFoundException{
  MatrixCursor cursor=new MatrixCursor(projection==null?DOCUMENT_COLUMNS:projection);
  addDocument(cursor,DIRECTORY.equals(id)?null:requireCapture(id));
  return cursor;
 }

 @Override public Cursor queryChildDocuments(String id,String[] projection,String sortOrder)throws FileNotFoundException{
  if(!DIRECTORY.equals(id))throw new FileNotFoundException();
  MatrixCursor cursor=new MatrixCursor(projection==null?DOCUMENT_COLUMNS:projection);
  for(File file:DashboardRecording.captures(getContext()))addDocument(cursor,file);
  return cursor;
 }

 @Override public ParcelFileDescriptor openDocument(String id,String mode,CancellationSignal signal)throws FileNotFoundException{
  if(!"r".equals(mode))throw new FileNotFoundException();
  return ParcelFileDescriptor.open(requireCapture(id),ParcelFileDescriptor.MODE_READ_ONLY);
 }

 private File requireCapture(String id)throws FileNotFoundException{
  File file=DashboardRecording.findCapture(getContext(),id);
  if(file==null)throw new FileNotFoundException();
  return file;
 }

 private void addDocument(MatrixCursor cursor,File file){
  MatrixCursor.RowBuilder row=cursor.newRow();
  if(file==null){
   row.add(Document.COLUMN_DOCUMENT_ID,DIRECTORY).add(Document.COLUMN_DISPLAY_NAME,TITLE)
    .add(Document.COLUMN_MIME_TYPE,Document.MIME_TYPE_DIR).add(Document.COLUMN_FLAGS,0);
   return;
  }
  String name=file.getName();
  row.add(Document.COLUMN_DOCUMENT_ID,name).add(Document.COLUMN_DISPLAY_NAME,name)
   .add(Document.COLUMN_MIME_TYPE,name.endsWith(".jpg")?"image/jpeg":"video/mp4")
   .add(Document.COLUMN_SIZE,file.length()).add(Document.COLUMN_LAST_MODIFIED,file.lastModified())
   .add(Document.COLUMN_FLAGS,0);
 }
}
