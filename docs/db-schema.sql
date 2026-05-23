CREATE TABLE branches (
  branch_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_name VARCHAR(100) NOT NULL,
  address VARCHAR(255),
  phone VARCHAR(30),
  use_yn CHAR(1) DEFAULT 'Y',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  login_id VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(50) NOT NULL,
  role ENUM('OWNER','STAFF','KIOSK') NOT NULL,
  branch_id BIGINT NULL,
  use_yn CHAR(1) DEFAULT 'Y',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
);

CREATE TABLE members (
  member_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  name VARCHAR(50) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  product_name VARCHAR(100),
  pass_type ENUM('COUNT','PERIOD') NOT NULL,
  remaining_count INT DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status ENUM('ACTIVE','EXPIRED','REST') DEFAULT 'ACTIVE',
  memo TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(branch_id),
  INDEX idx_members_phone (phone)
);

CREATE TABLE attendance (
  attendance_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  member_id BIGINT NOT NULL,
  branch_id BIGINT NOT NULL,
  checkin_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  result ENUM('SUCCESS','EXPIRED','NO_COUNT','NOT_FOUND') NOT NULL,
  source ENUM('STAFF','KIOSK') DEFAULT 'KIOSK',
  FOREIGN KEY (member_id) REFERENCES members(member_id),
  FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
);

CREATE TABLE payments (
  payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  member_id BIGINT NOT NULL,
  branch_id BIGINT NOT NULL,
  payment_method ENUM('CASH','CARD','TRANSFER') NOT NULL,
  amount INT NOT NULL,
  discount_amount INT DEFAULT 0,
  refund_amount INT DEFAULT 0,
  memo TEXT,
  paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(member_id),
  FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
);

CREATE TABLE crm_logs (
  crm_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  member_id BIGINT NULL,
  name VARCHAR(50),
  phone VARCHAR(30),
  status VARCHAR(50),
  memo TEXT,
  next_contact_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(branch_id),
  FOREIGN KEY (member_id) REFERENCES members(member_id)
);

CREATE TABLE expenses (
  expense_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  category ENUM('RENT','PAYROLL','AD','ETC') NOT NULL,
  title VARCHAR(100) NOT NULL,
  amount INT NOT NULL,
  is_fixed CHAR(1) DEFAULT 'N',
  expense_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
);

CREATE TABLE staff_schedules (
  schedule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  branch_id BIGINT NOT NULL,
  work_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  schedule_type ENUM('NORMAL','SUBSTITUTE','DAY_OFF','OVERTIME') DEFAULT 'NORMAL',
  admin_memo TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
);

CREATE TABLE salaries (
  salary_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  branch_id BIGINT NOT NULL,
  salary_type ENUM('MONTHLY','HOURLY','PER_CLASS') NOT NULL,
  base_amount INT NOT NULL,
  overtime_amount INT DEFAULT 0,
  bonus_amount INT DEFAULT 0,
  deduction_amount INT DEFAULT 0,
  salary_month CHAR(7) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
);
