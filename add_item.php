<?php
$db = new SQLite3('lost_found.db');

if (!$db) {
    die("Database connection failed");
}

if (isset($_POST['add_item'])) {
    $item_name = trim($_POST['item_name']);
    $category  = trim($_POST['category']);
    $location  = trim($_POST['location']);
    $date      = trim($_POST['date']);
    $type      = trim($_POST['type']);

    if ($item_name == "" || $category == "" || $location == "" || $date == "" || $type == "") {
        die("All fields are required.");
    }

    $stmt = $db->prepare("INSERT INTO items (item_name, category, location, date, type, status) 
                          VALUES (:item_name, :category, :location, :date, :type, 'Not Returned')");

    $stmt->bindValue(':item_name', $item_name, SQLITE3_TEXT);
    $stmt->bindValue(':category', $category, SQLITE3_TEXT);
    $stmt->bindValue(':location', $location, SQLITE3_TEXT);
    $stmt->bindValue(':date', $date, SQLITE3_TEXT);
    $stmt->bindValue(':type', $type, SQLITE3_TEXT);

    $result = $stmt->execute();

    if ($result) {
        echo "Item added successfully! <br><br>";
        echo "<a href='admin.php'>Go back to Admin Panel</a>";
    } else {
        echo "Error adding item.";
    }
}
?>