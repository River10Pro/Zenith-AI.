<?php
// Cabeceras de seguridad para CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Manejo de peticiones de verificación del navegador (Preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Obtener datos del Frontend
$input = file_get_contents("php://input");
$data = json_decode($input, true);

if (!isset($data["messages"])) {
    echo json_encode(["error" => "No se recibieron mensajes"]);
    exit;
}

// Configuración de la API (Variable de entorno en Render)
$apiKey = getenv('GROQ_API_KEY');
$url = "https://api.groq.com/openai/v1/chat/completions";

$payload = [
    "model" => "llama-3.1-8b-instant",
    "messages" => $data["messages"]
];

// Llamada a Groq vía cURL
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "Authorization: Bearer " . $apiKey
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Devolver respuesta al Frontend
header('Content-Type: application/json');
http_response_code($httpCode);
echo $response;
?>