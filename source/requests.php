<?php
/*
Author: Fiona Waser

This script enables to execute PHP Functions in JavaScript and retrieve the results.

Write your needed PHP functions into the code below.
Then send an Ajax-Request to this page (see example below in same comment section) containing the function name and the arguments.
This Script takes the call, executes it and put the result into a JSON-Object. Like this, it sends the result back to the Ajax-Request.

jQuery.ajax({
	type: "POST",
	url: 'requests.php',
	dataType: 'json',
	data: {functionname: 'processQueryHeaderRequest', argument: query},

	success: function (obj, textstatus) {
		if(!('error' in obj) ) {
			resultHeader = obj.result;
		}
	}
});
*/

include "functions_dbvisualizer.php";

header('Content-Type: application/json');

$result = array();

if(!isset($_POST['functionname'])) { 
	$result['error'] = 'No function name provided.';
}
	
if(!isset($_POST['argument'])) { 
	$result['error'] = 'No function arguments provided.'; 
}

if(!isset($result['error'])) {
	switch($_POST['functionname']) {
		case 'processQueryHeaderRequest':
			$result['result'] = processQueryHeaderRequest($_POST['argument']);
			break;
			
		case 'processQueryRequest':
			$result['result'] = processQueryRequest($_POST['argument']);
			break;
			
		case 'getAttributesAutocomplete':
			$result['result'] = getAttributesAutocomplete($_POST['argument']['input'],$_POST['argument']['table']);
			break;

		default:
			$result['error'] = 'Function '.$_POST['functionname'].' not found.';
			break;
	}
}

echo json_encode($result);
?>