<!--
Author: Fiona Waser
-->

<html>
<head>
	<meta charset="utf-8">
	<link rel="stylesheet" type="text/css" href="dbvisualizer.css">
	<script src="lib/d3.js"></script>
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
				<select name="searchTable">
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
				<input type="text" name="searchexpression" value="<?php if(isset($_POST['searchexpression'])) echo $_POST['searchexpression']; ?>" placeholder="Search Term" size="100"/>
				<input type="number" name="limit" value="<?php if(isset($_POST['limit'])) echo $_POST['limit']; else echo 10; ?>"/>
				<input type="submit" name="submitSearch" value="Search">
			</p>
			
		<?php
		if(isset($_POST['submitSearch'])) {
			$expression = "";
			if(!empty($_POST['searchexpression'])) {
				$expression = $_POST['searchexpression'];
			}
			
			$tableIndex = 0;
			foreach($tables->table as $table) {
				if(strcmp($table->name, $_POST["searchTable"]) == 0) {
					break;
				}
				$tableIndex++;
			}
			
			$attrs = "";
			foreach($tables->table[$tableIndex]->attributes->attribute as $attribute) {
				$attrs .= ",".$attribute->field;
			}
			
			$query = "SELECT * FROM ".$_POST['searchTable']." WHERE CONCAT_WS(' '".$attrs.") LIKE LOWER('%".$expression."%') LIMIT ".$_POST['limit'];
			$res = mysqli_query($con, $query);
				
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
		}
		?>
		</form>
	</div>
</body>
</html>