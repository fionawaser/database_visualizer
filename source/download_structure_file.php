<?php
$filename = "tables.xml";
$path = getcwd();
$fileUrl = $path."/".$filename;

header('Content-Type: application/octet-stream');
header("Content-Transfer-Encoding: Binary"); 
header("Content-disposition: attachment; filename= ".$filename);

readfile($fileUrl);

exit();
?>