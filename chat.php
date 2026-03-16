<?php
// 1. Cabeceras de seguridad para CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// 2. Manejo de peticiones de verificación del navegador (Preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 3. Obtener y validar datos del Frontend
$input = file_get_contents("php://input");
$data = json_decode($input, true);

if (!isset($data["messages"]) || empty($data["messages"])) {
    header('Content-Type: application/json');
    echo json_encode(["error" => "No se recibieron mensajes válidos"]);
    exit;
}

// 4. Configuración de la API
$apiKey = getenv('GROQ_API_KEY');
$url = "https://api.groq.com/openai/v1/chat/completions";

// Si por alguna razón la API Key no está en Render, esto evitará un error vacío
if (!$apiKey) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(["error" => "Falta la API Key en el servidor"]);
    exit;
}

$payload = [
    "model" => "llama-3.1-8b-instant",
    "messages" => $data["messages"],
    "temperature" => 0.7, // Añadimos un poco de naturalidad a la respuesta
    "max_tokens" => 1024
];

// 5. Llamada a Groq vía cURL
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "Authorization: Bearer " . $apiKey
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_TIMEOUT, 30); // Tiempo límite de espera

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    $error_msg = curl_error($ch);
    curl_close($ch);
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(["error" => "Error de conexión: " . $error_msg]);
    exit;
}

curl_close($ch);

// 6. Devolver respuesta al Frontend
header('Content-Type: application/json');
http_response_code($httpCode);
echo $response;
?>
