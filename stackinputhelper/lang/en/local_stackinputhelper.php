<?php

$string['pluginname'] = 'STACK Input Helper';

$string['enabled'] = 'Enable STACK Input Helper';
$string['enabled_desc'] = 'Enable or disable the STACK input helper plugin.';

$string['mathpixappid'] = 'Mathpix App ID';
$string['mathpixappid_desc'] = 'The Mathpix application ID used by the Moodle plugin backend.';

$string['mathpixappkey'] = 'Mathpix App Key';
$string['mathpixappkey_desc'] = 'The Mathpix application key. This is stored in Moodle settings and is never sent to the browser.';

$string['maxfilesize'] = 'Maximum image size';
$string['maxfilesize_desc'] = 'Maximum upload image size in MB.';

$string['enablemobile'] = 'Enable mobile upload';
$string['enablemobile_desc'] = 'Allow users to upload mathematical expression images from a mobile device using a QR code.';
$string['mobilebaseurl'] = 'Mobile public base URL';
$string['mobilebaseurl_desc'] = 'Optional Moodle base URL that mobile devices can open, for example http://192.168.1.20:8000. Leave empty to use the Moodle site URL.';

$string['uploadbtn'] = 'Upload math image';
$string['mobileuploadbtn'] = 'Mobile Math Upload';
$string['uploading'] = 'Recognizing...';
$string['nofieldfound'] = 'No visible answer input found on this page.';
$string['recognizefailed'] = 'Recognition failed.';
$string['invalidfiletype'] = 'Invalid file type. Please upload a JPG or PNG image.';
$string['filetoolarge'] = 'The uploaded image is too large.';
$string['missingmathpixcredentials'] = 'Mathpix App ID or App Key is not configured.';
$string['invaliduploadedfile'] = 'The uploaded file is invalid.';
$string['curlrequired'] = 'The PHP cURL extension is required.';
$string['mathpixrequestfailed'] = 'The Mathpix request failed.';
$string['mathpixinvalidresponse'] = 'Mathpix returned an invalid response.';
$string['pluginnotenabled'] = 'STACK Input Helper is disabled.';
$string['mobilenotenabled'] = 'Mobile upload is disabled.';
$string['sessionexpired'] = 'This mobile upload session has expired.';
$string['mobileuploadinstructions'] = 'Take a photo of a mathematical expression. The result will be sent back to the Moodle page that created this session.';
$string['mobileuploadcomplete'] = 'Upload complete. You can return to the original Moodle page.';
$string['nofilechosen'] = 'Please choose an image first.';
$string['takephoto'] = 'Take photo';
$string['usethisphoto'] = 'Use this photo';
$string['privacy:metadata:mathpix'] = 'Uploaded images are sent to Mathpix for mathematical expression recognition.';
$string['privacy:metadata:mathpix:image'] = 'The mathematical expression image uploaded by the user.';
$string['privacy:metadata:session'] = 'Temporary mobile upload sessions and recognition results.';
$string['privacy:metadata:session:userid'] = 'The user who created the mobile upload session.';
$string['privacy:metadata:session:rawlatex'] = 'The raw LaTeX returned by Mathpix.';
$string['privacy:metadata:session:stack'] = 'The STACK expression generated from the raw LaTeX.';
$string['privacy:metadata:session:resulttext'] = 'The recognized result returned to the Moodle page.';
$string['privacy:metadata:session:timecreated'] = 'The time when the mobile upload session was created.';
$string['privacy:metadata:session:timemodified'] = 'The time when the mobile upload session was last modified.';
$string['privacy:metadata:session:expiresat'] = 'The time when the mobile upload session expires.';
