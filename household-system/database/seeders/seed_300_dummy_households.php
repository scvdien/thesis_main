<?php
declare(strict_types=1);

require dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'db.php';

const SEED_YEAR = 2026;
const HOUSEHOLD_TOTAL = 300;

/** @param array<string, mixed> $value */
function seed_json(array $value): string
{
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

/** @param array<string, mixed> $person */
function seed_full_name(array $person): string
{
    return trim(implode(' ', array_filter([
        $person['first_name'] ?? '',
        $person['middle_name'] ?? '',
        $person['last_name'] ?? '',
        $person['extension_name'] ?? '',
    ], static fn (mixed $value): bool => trim((string) $value) !== '')));
}

/**
 * @param array<string, string> $home
 * @return array<string, string>
 */
function seed_person(
    int $sequence,
    string $firstName,
    string $middleName,
    string $lastName,
    string $sex,
    int $age,
    string $relation,
    int $householdSize,
    array $home,
    string $partnerName = ''
): array {
    $month = (($sequence * 3) % 6) + 1;
    $day = (($sequence * 7) % 25) + 1;
    $birthday = sprintf('%04d-%02d-%02d', SEED_YEAR - $age, $month, $day);
    $isChild = $age < 18;
    $isSenior = $age >= 60;
    $isAdult = $age >= 18;
    $isStudent = $age >= 6 && $age <= 22;
    $isFourPs = $home['4ps'];

    $education = match (true) {
        $age < 6 => 'Not Yet in School',
        $age <= 11 => 'Elementary',
        $age <= 15 => 'Junior High School',
        $age <= 18 => 'Senior High School',
        $age <= 22 => 'College Level',
        $sequence % 4 === 0 => 'College Graduate',
        $sequence % 4 === 1 => 'High School Graduate',
        $sequence % 4 === 2 => 'Vocational Graduate',
        default => 'Elementary Graduate',
    };
    $occupations = ['Farmer', 'Vendor', 'Driver', 'Carpenter', 'Teacher', 'Office Staff', 'Fisher', 'Storekeeper'];
    $workTypes = ['Agriculture', 'Retail', 'Transport', 'Construction', 'Government', 'Private', 'Fishing', 'Self-Employed'];
    $occupation = $isStudent ? 'Student' : ($isAdult ? $occupations[$sequence % count($occupations)] : 'None');
    $employment = $isStudent ? 'N/A' : ($isAdult ? ($sequence % 5 === 0 ? 'Self-Employed' : 'Employed') : 'N/A');
    $income = $isStudent || !$isAdult ? '0' : (string) (8000 + (($sequence * 1375) % 22000));
    $civilStatus = $relation === 'Spouse' ? 'Married' : (($relation === 'Head' && $partnerName !== '') ? 'Married' : 'Single');
    $contact = $isAdult ? '09' . str_pad((string) (100000000 + $sequence), 9, '0', STR_PAD_LEFT) : '';
    $residentTag = str_pad((string) $sequence, 6, '0', STR_PAD_LEFT);

    return [
        'first_name' => $firstName,
        'middle_name' => $middleName,
        'last_name' => $lastName,
        'extension_name' => '',
        'birthday' => $birthday,
        'age' => (string) $age,
        'sex' => $sex,
        'civil_status' => $civilStatus,
        'citizenship' => 'Filipino',
        'religion' => $sequence % 5 === 0 ? 'Christian' : 'Roman Catholic',
        'blood_type' => ['O+', 'A+', 'B+', 'AB+', 'O-'][$sequence % 5],
        'height' => (string) ($isChild ? 105 + min(55, $age * 3) : 150 + ($sequence % 25)),
        'weight' => (string) ($isChild ? 14 + ($age * 2) : 48 + ($sequence % 35)),
        'pregnant' => $sex === 'Female' && $age >= 18 && $age <= 45 && $sequence % 11 === 0 ? 'Yes' : 'No',
        'contact' => $contact,
        'address' => $home['address'],
        'zone' => $home['zone'],
        'barangay' => 'Cabarian',
        'city' => 'Ligao City',
        'province' => 'Albay',
        'education' => $education,
        'degree' => $education === 'College Graduate' ? ['BS Agriculture', 'BS Education', 'BS Information Technology'][$sequence % 3] : '',
        'school_name' => $isStudent ? ($age <= 11 ? 'Cabarian Elementary School' : 'Ligao National High School') : '',
        'school_type' => 'Public',
        'dropout' => 'No',
        'osy' => $isStudent ? 'No' : ($age <= 24 && $sequence % 13 === 0 ? 'Yes' : 'No'),
        'currently_studying' => $isStudent ? 'Yes' : 'No',
        'occupation' => $occupation,
        'employment_status' => $employment,
        'work_type' => $isAdult && !$isStudent ? $workTypes[$sequence % count($workTypes)] : '',
        'monthly_income' => $income,
        '4ps' => $isFourPs,
        'four_ps' => $isFourPs,
        'senior' => $isSenior ? 'Yes' : 'No',
        'pwd' => $sequence % 37 === 0 ? 'Yes' : 'No',
        'ip' => $sequence % 29 === 0 ? 'Yes' : 'No',
        'voter' => $age >= 18 ? 'Yes' : 'No',
        'precinct' => $age >= 18 ? 'CAB-' . str_pad((string) (($sequence % 30) + 1), 3, '0', STR_PAD_LEFT) : '',
        'sss' => $isAdult ? 'SSS-' . $residentTag : '',
        'philhealth' => 'PH-' . $residentTag,
        'gsis' => $isAdult && $sequence % 7 === 0 ? 'GSIS-' . $residentTag : '',
        'tin' => $isAdult ? 'TIN-' . $residentTag : '',
        'philid' => 'PHILID-' . $residentTag,
        'driver_license' => $isAdult && $sequence % 4 === 0 ? 'N01-' . $residentTag : '',
        'passport' => $isAdult && $sequence % 17 === 0 ? 'P' . $residentTag : '',
        'num_members' => (string) $householdSize,
        'relation_to_head' => $relation === 'Head' ? '' : $relation,
        'num_children' => $relation === 'Head' || $relation === 'Spouse' ? (string) max(0, $householdSize - 2) : '0',
        'partner_name' => $partnerName,
        'house_type' => $home['house_type'],
        'ownership' => $home['ownership'],
        'num_rooms' => $home['num_rooms'],
        'toilet' => $home['toilet'],
        'electricity' => $home['electricity'],
        'water' => $home['water'],
        'internet' => $home['internet'],
    ];
}

$maleNames = ['Jose', 'Mario', 'Ramon', 'Antonio', 'Roberto', 'Daniel', 'Mark', 'John Paul', 'Carlo', 'Miguel', 'Paolo', 'Gabriel', 'Noel', 'Edgar', 'Jun', 'Renato', 'Dennis', 'Allan', 'Victor', 'Leo', 'Nestor', 'Arnel', 'Rogelio', 'Ben'];
$femaleNames = ['Maria', 'Ana', 'Liza', 'Grace', 'Rosa', 'Elena', 'Joy', 'Catherine', 'Mila', 'Teresa', 'Angelica', 'Cristina', 'Marites', 'Jenny', 'Lea', 'Nina', 'Carla', 'Aileen', 'Jessa', 'Mylene', 'Diana', 'Ruby', 'Cecilia', 'Lorna'];
$middleNames = ['Reyes', 'Santos', 'Garcia', 'Mendoza', 'Flores', 'Rivera', 'Castillo', 'Navarro', 'Aquino', 'Ramos', 'Diaz', 'Lopez'];
$lastNames = ['Cruz', 'Santos', 'Reyes', 'Garcia', 'Mendoza', 'Flores', 'Rivera', 'Castillo', 'Navarro', 'Aquino', 'Ramos', 'Diaz', 'Lopez', 'Torres', 'Villanueva', 'Bautista', 'Fernandez', 'Mercado', 'Salazar', 'Domingo'];

$pdo = db_connection();
$existing = (int) $pdo->query('SELECT COUNT(*) FROM `registration_households`')->fetchColumn();
if ($existing !== 0) {
    throw new RuntimeException("Seeder stopped: registration_households already contains {$existing} record(s).");
}

$insertHousehold = $pdo->prepare(
    'INSERT INTO `registration_households`
     (`household_code`, `record_year`, `rollover_source_household_code`, `source`, `head_name`, `zone`, `member_count`,
      `head_data_json`, `members_data_json`, `record_data_json`, `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`)
     VALUES
     (:code, :year, "", "dummy-seed-2026", :head_name, :zone, :member_count,
      :head_json, :members_json, :record_json, NULL, NULL, :created_at, :updated_at)'
);
$insertMember = $pdo->prepare(
    'INSERT INTO `registration_members`
     (`household_id`, `household_code`, `record_year`, `resident_code`, `member_order`, `full_name`,
      `relation_to_head`, `sex`, `age`, `zone`, `member_data_json`, `created_at`, `updated_at`)
     VALUES
     (:household_id, :household_code, :year, :resident_code, :member_order, :full_name,
      :relation, :sex, :age, :zone, :person_json, :created_at, :updated_at)'
);
$insertResident = $pdo->prepare(
    'INSERT INTO `registration_residents`
     (`resident_code`, `household_id`, `household_code`, `record_year`, `source_type`, `member_order`,
      `full_name`, `relation_to_head`, `sex`, `age`, `zone`, `resident_data_json`, `created_at`, `updated_at`)
     VALUES
     (:resident_code, :household_id, :household_code, :year, :source_type, :member_order,
      :full_name, :relation, :sex, :age, :zone, :person_json, :created_at, :updated_at)'
);

$residentSequence = 0;
$totalMembers = 0;
$pdo->beginTransaction();

try {
    for ($householdNumber = 1; $householdNumber <= HOUSEHOLD_TOTAL; $householdNumber++) {
        $code = sprintf('HH-%d-%03d', SEED_YEAR, $householdNumber);
        $zoneNumber = (($householdNumber - 1) % 5) + 1;
        $zone = "Zone {$zoneNumber}";
        $purok = (($householdNumber - 1) % 20) + 1;
        $householdSize = 2 + ($householdNumber % 5);
        $fourPs = $householdNumber % 4 === 0 ? 'Yes' : 'No';
        $createdAt = sprintf('2026-%02d-%02d %02d:%02d:00', (($householdNumber - 1) % 7) + 1, (($householdNumber * 3) % 25) + 1, 8 + ($householdNumber % 9), ($householdNumber * 7) % 60);
        $home = [
            'zone' => $zone,
            'address' => "Purok {$purok}, {$zone}, Barangay Cabarian, Ligao City, Albay",
            '4ps' => $fourPs,
            'house_type' => ['Concrete', 'Semi-Concrete', 'Wood', 'Mixed Materials'][$householdNumber % 4],
            'ownership' => ['Owned', 'Owned', 'Rented', 'Living with Relatives'][$householdNumber % 4],
            'num_rooms' => (string) (1 + ($householdNumber % 5)),
            'toilet' => ['Water-Sealed', 'Pour Flush', 'Shared Toilet'][$householdNumber % 3],
            'electricity' => $householdNumber % 19 === 0 ? 'No' : 'Yes',
            'water' => ['Level I', 'Level II', 'Level III'][$householdNumber % 3],
            'internet' => ['Fiber', 'Mobile Data', 'None'][$householdNumber % 3],
        ];

        $headSex = $householdNumber % 4 === 0 ? 'Female' : 'Male';
        $headFirstNames = $headSex === 'Female' ? $femaleNames : $maleNames;
        $headFirst = $headFirstNames[($householdNumber - 1) % count($headFirstNames)];
        $headMiddle = $middleNames[intdiv($householdNumber - 1, count($headFirstNames)) % count($middleNames)];
        $lastName = $lastNames[intdiv($householdNumber - 1, count($headFirstNames)) % count($lastNames)];
        $headAge = 28 + (($householdNumber * 7) % 39);

        $spouseSex = $headSex === 'Male' ? 'Female' : 'Male';
        $spouseFirstNames = $spouseSex === 'Female' ? $femaleNames : $maleNames;
        $spouseFirst = $spouseFirstNames[($householdNumber * 5) % count($spouseFirstNames)];
        $spouseMiddle = $middleNames[($householdNumber * 3) % count($middleNames)];
        $spouseAge = max(24, $headAge - 2 + ($householdNumber % 4));
        $headPreview = trim("{$headFirst} {$headMiddle} {$lastName}");
        $spousePreview = trim("{$spouseFirst} {$spouseMiddle} {$lastName}");

        $residentSequence++;
        $head = seed_person($residentSequence, $headFirst, $headMiddle, $lastName, $headSex, $headAge, 'Head', $householdSize, $home, $spousePreview);
        $headName = seed_full_name($head);
        $members = [];

        for ($memberOrder = 1; $memberOrder < $householdSize; $memberOrder++) {
            $residentSequence++;
            if ($memberOrder === 1) {
                $members[] = seed_person($residentSequence, $spouseFirst, $spouseMiddle, $lastName, $spouseSex, $spouseAge, 'Spouse', $householdSize, $home, $headPreview);
                continue;
            }

            $childSex = ($householdNumber + $memberOrder) % 2 === 0 ? 'Male' : 'Female';
            $childNames = $childSex === 'Male' ? $maleNames : $femaleNames;
            $childFirst = $childNames[($householdNumber + ($memberOrder * 7)) % count($childNames)];
            $childAge = max(2, min(24, $headAge - 21 - (($memberOrder - 2) * 3)));
            $members[] = seed_person(
                $residentSequence,
                $childFirst,
                $headMiddle,
                $lastName,
                $childSex,
                $childAge,
                $childSex === 'Male' ? 'Son' : 'Daughter',
                $householdSize,
                $home
            );
        }

        $record = [
            'household_id' => $code,
            'mode' => 'create',
            'source' => 'dummy-seed-2026',
            'head' => $head,
            'members' => $members,
            'head_name' => $headName,
            'zone' => $zone,
            'member_count' => $householdSize,
            'record_year' => SEED_YEAR,
            'rollover_source_household_id' => '',
            'updated_at' => str_replace(' ', 'T', $createdAt) . '+08:00',
            'server_synced_at' => str_replace(' ', 'T', $createdAt) . '+08:00',
        ];

        $insertHousehold->execute([
            'code' => $code,
            'year' => SEED_YEAR,
            'head_name' => $headName,
            'zone' => $zone,
            'member_count' => $householdSize,
            'head_json' => seed_json($head),
            'members_json' => seed_json($members),
            'record_json' => seed_json($record),
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
        $householdId = (int) $pdo->lastInsertId();

        $headResidentCode = sprintf('RS-%d-%04d', SEED_YEAR, $residentSequence - count($members));
        $insertResident->execute([
            'resident_code' => $headResidentCode,
            'household_id' => $householdId,
            'household_code' => $code,
            'year' => SEED_YEAR,
            'source_type' => 'head',
            'member_order' => 0,
            'full_name' => $headName,
            'relation' => 'Head',
            'sex' => $head['sex'],
            'age' => $head['age'],
            'zone' => $zone,
            'person_json' => seed_json(['head' => $head]),
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);

        foreach ($members as $index => $member) {
            $memberOrder = $index + 1;
            $memberResidentSequence = $residentSequence - count($members) + $memberOrder;
            $residentCode = sprintf('RS-%d-%04d', SEED_YEAR, $memberResidentSequence);
            $params = [
                'resident_code' => $residentCode,
                'household_id' => $householdId,
                'household_code' => $code,
                'year' => SEED_YEAR,
                'member_order' => $memberOrder,
                'full_name' => seed_full_name($member),
                'relation' => $member['relation_to_head'],
                'sex' => $member['sex'],
                'age' => $member['age'],
                'zone' => $zone,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ];
            $insertMember->execute($params + ['person_json' => seed_json($member)]);
            $insertResident->execute($params + [
                'source_type' => 'member',
                'person_json' => seed_json(['member' => $member]),
            ]);
            $totalMembers++;
        }
    }

    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $exception;
}

echo json_encode([
    'success' => true,
    'households' => HOUSEHOLD_TOTAL,
    'members' => $totalMembers,
    'residents' => $residentSequence,
    'year' => SEED_YEAR,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
