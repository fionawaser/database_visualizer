<!--
Author: Fiona Waser
-->

<html>
<head>
	<meta charset="utf-8">
	<link rel="stylesheet" type="text/css" href="dbvisualizer.css">
	<script type="text/javascript" src="lib/jquery-3.1.1.min.js"></script>
	<script type="text/javascript" src="search.js"></script>
	<title>Search</title>
	<link rel="shortcut icon" href="img/favicon.ico" type="image/x-icon">
	<link rel="icon" href="img/favicon.ico" type="image/x-icon">
</head>
<?php
if(!file_exists("config.ini")) {
	header("Location: setup.php");
	die();
}

$settings = parse_ini_file("config.ini", true);
include "functions_dbvisualizer.php";
		
$username = $settings['database']['user'];
$password = $settings['database']['password'];
$dbn = $settings['database']['db_name'];
$host = $settings['database']['host'];

$con = mysqli_connect($host, $username, $password);

mysqli_select_db($con, $dbn);
		
$tables = simplexml_load_file("tables.xml");
?>
<body>
	<h1>Database Visualizer</h1>
	<ul class="nav">
		<li><a href="index.php">Welcome Page</a></li>
		<li><a href="visualization.php">Visualization</a></li>
		<li><a href="search.php" class="active">Search</a></li>
	</ul>
	<div id="searchInterface">
		<h2>Search</h2>
		<form id="searchform" name="searchform" action="" method="post">
			<p>
				<select name="searchTable" id="searchTable">
					<?php
					foreach($tables->table as $table) {
						if($_POST["searchTable"] == $table->name) {
							echo "<option value='".$table->name."' selected='true'>".$table->name."</option>";
						} else {
							echo "<option value='".$table->name."'>".$table->name."</option>";
						}
					}
					?>
				</select>
				<input type="text" name="searchexpression" id="searchexpression" list="attributeSuggestions" value="<?php if(isset($_POST['searchexpression'])) echo $_POST['searchexpression']; ?>" placeholder="Search Term" size="100" oninput="searchAttributeAutocomplete(this.value);"><datalist id="attributeSuggestions"></datalist>
				<input type="number" name="limit" value="<?php if(isset($_POST['limit'])) echo $_POST['limit']; else echo 10; ?>"/>
				<input type="submit" name="submitSearch" value="Search">
			</p>
			
		<?php
		if(isset($_POST['submitSearch'])) {
			$expression = "";
			if(!empty($_POST['searchexpression'])) {
				$expression = $_POST['searchexpression'];
			}
			
			preg_match_all('/"(?:\\\\.|[^\\\\"])*"|\S+/', $expression, $matches);
			
			$keywords = array();
			foreach($matches[0] as $match) {
				$filtered = str_replace('"', "", $match);
				array_push($keywords, $filtered);
			}
			
			$searchByAttribute = false;
			foreach($keywords as $keyword) {
				$keywordCurrent = explode("=", $keyword);
				if(sizeof($keywordCurrent) >= 2) {
					$searchByAttribute = true;
					
					$searchByAttributeMapping = array();
					foreach($keywords as $keywordPush) {
						$current = explode("=", $keywordPush);
						
						array_push($searchByAttributeMapping, $current);
					}
				}
			}
			
			$tableIndex = 0;
			foreach($tables->table as $table) {
				if(strcmp($table->name, $_POST["searchTable"]) == 0) {
					break;
				}
				$tableIndex++;
			}
			
			$query = "SELECT * FROM ".$_POST['searchTable']." WHERE ";
			
			if($searchByAttribute) {
				$i = 0;
				foreach($searchByAttributeMapping as $mapping) {
					if($i == sizeof($searchByAttributeMapping)-1) {
						$query .= $mapping[0]." LIKE '%".$mapping[1]."%'";	
					} else {
						$query .= $mapping[0]." LIKE '%".$mapping[1]."%' AND ";
					}
					$i++;
				}
			} else {
				$attributes = array();
				foreach($tables->table[$tableIndex]->attributes->attribute as $attribute) {
					array_push($attributes, $attribute->field);
				}
				
				$attrs = "";
				foreach($attributes as $attribute) {
					$attrs .= ",".$attribute;
				}
				
				$i = 0;
				foreach($keywords as $keyword) {
					if($i == sizeof($keywords)-1) {
						$query .= "CONCAT_WS(' '".$attrs.") LIKE '%".$keyword."%'";	
					} else {
						$query .= "CONCAT_WS(' '".$attrs.") LIKE '%".$keyword."%' AND ";
					}
					$i++;
				}
			}
			
			$query .=  " LIMIT ".$_POST['limit'];
			
			if($res = mysqli_query($con, $query)) {
				$rows = array();
					
				if(mysqli_num_rows($res)) {
					$i = 0;
					while($row = mysqli_fetch_row($res)) {
						$rows[$i] = $row;
						$i++;
					}
					
					echo "<p><table>
						<tr>";
					foreach($tables->table[$tableIndex]->attributes->attribute as $attribute) {
						echo "<th>".$attribute->field."</th>";
					}
					echo "</tr>";
					foreach($rows as $row) {
						echo "<tr>";
						foreach($row as $r) {
							echo "<td>".$r."</td>";
						}
						echo "</tr>";
					}
					echo "</table></p>";
				}
			} else {
				echo "<p>Something is wrong with your search. Please check it and try again.</p>";
			}
		}
		?>
		</form>
	</div>
</body>
</html>