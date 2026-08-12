<?php
/**
 * lead.php - Free Inspection Request handler.
 *
 * Receives the booking wizard form via POST, validates it, and emails
 * the lead to the business inbox. Includes anti-spam measures:
 * honeypot field, client-side time trap, and IP rate limiting.
 */

declare(strict_types=1);

const RECIPIENT = 'info@tecnomedia.net';
const SENDER    = 'leads@foundationrepairmichiana.com';
const SITE_NAME = 'FOUNDATION WORKS';

function respond_json(bool $ok, string $error = '', int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $error]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond_json(false, 'Invalid request method.', 405);
}

// --- Honeypot: real users never see or fill this field ---
if (!empty($_POST['website'])) {
    respond_json(true); // silently pretend success so bots are not tipped off
}

// --- Time trap: reject submissions made within 3 seconds of page load ---
if (isset($_POST['hp-time'])) {
    $loaded = (int) $_POST['hp-time'];
    if ($loaded > 0 && time() - $loaded < 3) {
        respond_json(true);
    }
}

// --- Rate limit: max 5 submissions per IP per 10 minutes ---
function rate_limited(int $max, int $window): bool
{
    $dir  = sys_get_temp_dir() . '/fw-leads';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    $file = $dir . '/' . md5('ip:' . ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'));
    $now  = time();
    $hits = [];
    if (is_file($file)) {
        $hits = json_decode((string) file_get_contents($file), true);
        if (!is_array($hits)) {
            $hits = [];
        }
    }
    $hits = array_values(array_filter($hits, function ($t) use ($now, $window) {
        return $now - (int) $t < $window;
    }));
    if (count($hits) >= $max) {
        return true;
    }
    $hits[] = $now;
    @file_put_contents($file, json_encode($hits), LOCK_EX);
    return false;
}

if (rate_limited(5, 600)) {
    respond_json(false, 'Too many requests. Please try again later.', 429);
}

// --- Collect & validate required fields ---
$name  = trim((string) ($_POST['name'] ?? ''));
$email = trim((string) ($_POST['email'] ?? ''));
$phone = trim((string) ($_POST['phone'] ?? ''));
$city  = trim((string) ($_POST['city'] ?? ''));

if ($name === '' || $email === '' || $phone === '' || $city === '') {
    respond_json(false, 'Please fill out all required fields.', 400);
}
if (strlen($name) > 120 || strlen($phone) > 30 || strlen($city) > 80) {
    respond_json(false, 'One or more fields contain invalid values.', 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond_json(false, 'Please enter a valid email address.', 400);
}

// --- Optional wizard context (sanitized for output) ---
$issueList   = trim((string) ($_POST['issues'] ?? ''));
$foundation  = trim((string) ($_POST['foundation-type'] ?? ''));
$propertyAge = trim((string) ($_POST['property-age'] ?? ''));
$prefDate    = trim((string) ($_POST['pref-date'] ?? ''));
$plan        = trim((string) ($_POST['plan'] ?? ''));
$estimate    = trim((string) ($_POST['estimate'] ?? ''));

$safe = function ($v) {
    return htmlspecialchars(strip_tags((string) $v), ENT_QUOTES, 'UTF-8');
};

$subject = 'New Free Inspection Request - ' . $safe($city);
if ($issueList !== '') {
    $subject .= ' - ' . substr($safe($issueList), 0, 60);
}

$lines   = [];
$lines[] = 'A new inspection request was submitted from the booking wizard.';
$lines[] = '';
$lines[] = 'CONTACT DETAILS';
$lines[] = 'Name:   ' . $safe($name);
$lines[] = 'Email:  ' . $safe($email);
$lines[] = 'Phone:  ' . $safe($phone);
$lines[] = 'City:   ' . $safe($city);
$lines[] = '';
$lines[] = 'REQUEST DETAILS';
$lines[] = 'Issues:            ' . ($safe($issueList) ?: 'None specified');
$lines[] = 'Foundation type:   ' . ($safe($foundation) ?: 'Not specified');
$lines[] = 'Property age:      ' . ($safe($propertyAge) ?: 'Not specified');
$lines[] = 'Preferred date:    ' . ($safe($prefDate) ?: 'Flexible');
$lines[] = 'Recommended plan:  ' . ($safe($plan) ?: 'N/A');
$lines[] = 'Estimated range:   ' . ($safe($estimate) ?: 'N/A');
$lines[] = '';
$lines[] = 'Submitted: ' . date('Y-m-d H:i:s');
$lines[] = 'Source:    ' . ($_SERVER['HTTP_REFERER'] ?? 'direct');
$body = implode("\n", $lines);

$headers  = 'From: ' . SITE_NAME . ' <' . SENDER . '>' . "\r\n";
$headers .= 'Reply-To: ' . $safe($email) . "\r\n";
$headers .= 'Return-Path: ' . SENDER . "\r\n";
$headers .= 'X-Mailer: PHP/' . phpversion() . "\r\n";
$headers .= 'Content-Type: text/plain; charset=UTF-8' . "\r\n";

if (@mail(RECIPIENT, $subject, $body, $headers)) {
    respond_json(true);
}
respond_json(false, 'Your request could not be sent. Please call us at (574) 800-4540.', 500);
