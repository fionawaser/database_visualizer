<?php
include "functions_dbvisualizer.php";

header('Content-Type: application/json');

$aResult = array();

if( !isset($_POST['functionname']) ) { $aResult['error'] = 'No function name!'; }
	
if( !isset($_POST['argument']) ) { $aResult['error'] = 'No function arguments!'; }

if( !isset($aResult['error']) ) {
	switch($_POST['functionname']) {
		case 'processQueryRequest':
			$aResult['result'] = processQueryRequest($_POST['argument']);
			break;
			
		case 'processQueryHeaderRequest':
			$aResult['result'] = processQueryHeaderRequest($_POST['argument']);
			break;

		default:
			$aResult['error'] = 'Not found function '.$_POST['functionname'].'!';
			break;
	}
}

echo json_encode($aResult);
?>