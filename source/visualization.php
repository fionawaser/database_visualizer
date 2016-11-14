<!--
Author: Fiona Waser
-->

<html>
<head>
	<meta charset="utf-8">
	<link rel="stylesheet" type="text/css" href="dbvisualizer.css">
	<script type="text/javascript" src="lib/d3.js"></script>
	<script type="text/javascript" src="lib/jquery-3.1.1.min.js"></script>
	<script type="text/javascript" src="lib/graph.js"></script>
	<script type="text/javascript" src="dbvisualizer.js"></script>
	<title>Database Visualizer</title>
</head>
<?php
$settings = parse_ini_file("config.ini", true);
include "functions_dbvisualizer.php";
		
$username = $settings['database']['user'];
$password = $settings['database']['password'];
$dbn = $settings['database']['db_name'];
$host = $settings['database']['host'];

$con = mysqli_connect($host, $username, $password);

mysqli_select_db($con, $dbn);
	
$tables = simplexml_load_file("tables.xml");

$nr_tables = $tables->count();

if(isset($_POST['refreshConfirmation']) && $_POST['refreshConfirmation'] == "yes") {
	refreshRowRelatedInfo($con, $tables, $dbn);
}
?>
<body>
	<h1>Database Visualizer</h1>
	<ul class="nav">
		<li><a href="index.php">Welcome Page</a></li>
		<li><a href="visualization.php" class="active">Visualization</a></li>
		<li><a href="search.php">Search</a></li>
	</ul> 
	<div id="topbarLeft">
		<div id="infobar">
			<h3>Database: <?php print($dbn); ?>, Number of Tables: <?php print($nr_tables); ?></h3>
			<div id="diagramTitle"><h2>Tables</h2></div>
		</div>
		<div id="structuralForm">
			<form id="refreshInfosForm" name="refreshInfosForm" action="" method="post">
				<input type="hidden" name="refreshConfirmation" id="refreshConfirmation" value="">
				<input type="submit" name="refreshRowInfo" value="Refresh Row-Related Information" onclick="confirmRefreshRowRelatedInfo();">
			</form>
		</div>
	</div>
	<div id="topbarRight">
		<div id="helpParent" class="help">
			<div id="helpPopup" style="display: none"></div>
		</div>
		<div id="sortChordDiagram">
			<span style="font-size: 12px; font-weight: bold; color: #000066;">Sort by:</span><br/>
			<form action="" method="post">
				<input type="radio" id="sortModePath" name="sortModePath" value="alphabetical" onclick="window.location.reload();" checked> Alphabetical<br>
				<input type="radio" id="sortModePath" name="sortModePath" value="nrRows" onclick="window.location.reload();"> Nr. Rows<br>
				<input type="radio" id="sortModePath" name="sortModePath" value="nrFields" onclick="window.location.reload();"> Nr. Fields<br>
			</form>
		</div>
	</div>
	<div id="content">
		<div id="leftSidebar">
			<div id="diagram"></div>
			<div id="legends"></div>
		</div>
		<div id="rightSidebar">
			<div id="attributeInfo"><span style="margin-right: 150px;">Go with your mouse pointer over a table to see information about its attributes.</span></div>
		</div>
		<div id="rows">
			<h2>Rows</h2>
			<div id="rowsConfig">
				<p>Number of rows: <input type="number" name="limit" id="limit" value="10" onclick="showRows();"/></p>
			</div>
			<div id="query"><p>Choose some tables to create a SELECT statement.</p></div>
			<div id="rowsTable"></div>
		</div>
	</div>
</body>
<script>
	// refresh on first load of page to avoid getting the old chord diagram
	window.onload = function() {
		if(!window.location.hash) {
			window.location = window.location + '#loaded';
			window.location.reload();
		}
	}
	
	prepareStructuralView();
</script>
</html>
