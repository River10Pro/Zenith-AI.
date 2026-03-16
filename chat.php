<?php
// 1. Cabeceras de seguridad: Indispensables para que tu App Android pueda hablar con el servidor
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// 2. Manejo de peticiones previas (OPTIONS): Necesario para navegadores y apps
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 3. Obtener los datos enviados por tu App
$input = file_get_contents("php://input");
$data = json_decode($input, true);

if (!$data || !isset($data["messages"])) {
    echo json_encode(["error" => "No se recibió historial"]);
    exit;
}

// 4. Clave de API segura (La configuraremos en Render en el siguiente paso)
// getenv() busca la variable que configuraremos en el panel de Render
$apiKey = getenv('GROQ_API_KEY');

if (!$apiKey) {
    echo json_encode(["error" => "API Key no configurada en el servidor"]);
    exit;
}

// 5. Conectar con Groq
$url = "https://api.groq.com/openai/v1/chat/completions";

$postData = [
    "model" => "llama-3.1-8b-instant",
    "messages" => $data["messages"]
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "Authorization: Bearer " . $apiKey
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
curl_setopt($ch, CURLOPT_TIMEOUT, 30); // Tiempo límite para respuesta

$response = curl_exec($ch);
$error = curl_error($ch);
curl_close($ch);

// 6. Respuesta final
if ($error) {
    echo json_encode(["error" => "Error de conexión con Groq: " . $error]);
} else {
    echo $response;
}
?>