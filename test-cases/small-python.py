# 小型 Python 测试用例：数据验证和处理

import re
from typing import Dict, List, Optional
from datetime import datetime
# @contract: validate_and_process_user_data(user_data: Dict[str, any], required_fields: List[str]) => Dict[str, any]
# @step: [验证] 检查用户数据不为空
# @step: [验证] 检查所有必需字段是否存在
# @step: [验证] 若存在email字段，验证其格式
# @step: [验证] 若存在age字段，验证其类型和范围
# @step: [处理] 遍历数据，对字符串值进行strip操作
# @step: [标记] 添加处理时间戳和验证标志
# @boundary: 当user_data为空时，抛出ValidationError
# @boundary: 当必需字段缺失时，抛出ValidationError
# @boundary: 当email格式不符合正则表达式时，抛出ValidationError
# @boundary: 当age不是整数或超出0-150范围时，抛出ValidationError

import re
from datetime import datetime
from typing import Dict, List, Any

class ValidationError(Exception):
    pass

def validate_and_process_user_data(user_data: Dict[str, Any], required_fields: List[str]) -> Dict[str, Any]:
    if not user_data:
        raise ValidationError("user_data cannot be empty")
    
    for field in required_fields:
        if field not in user_data:
            raise ValidationError(f"Required field '{field}' is missing")
    
    if "email" in user_data:
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, user_data["email"]):
            raise ValidationError(f"Invalid email format: {user_data['email']}")
    
    if "age" in user_data:
        if not isinstance(user_data["age"], int):
            raise ValidationError(f"age must be an integer, got {type(user_data['age']).__name__}")
        if user_data["age"] < 0 or user_data["age"] > 150:
            raise ValidationError(f"age must be between 0 and 150, got {user_data['age']}")
    
    processed_data = {}
    for key, value in user_data.items():
        if isinstance(value, str):
            processed_data[key] = value.strip()
        else:
            processed_data[key] = value
    
    processed_data["_processed_at"] = datetime.now().isoformat()
    processed_data["_validated"] = True
    
    return processed_data
# @end


class ValidationError(Exception):
    pass

def validate_and_process_user_data(
    user_data: Dict[str, any],
    required_fields: List[str]
) -> Dict[str, any]:
    """
    验证并处理用户数据
    """
    if not user_data:
        raise ValidationError("User data cannot be empty")

    for field in required_fields:
        if field not in user_data:
            raise ValidationError(f"Missing required field: {field}")

    if 'email' in user_data:
        email = user_data['email']
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            raise ValidationError(f"Invalid email format: {email}")

    if 'age' in user_data:
        age = user_data['age']
        if not isinstance(age, int) or age < 0 or age > 150:
            raise ValidationError(f"Invalid age: {age}")

    processed_data = {}
    for key, value in user_data.items():
        if isinstance(value, str):
            processed_data[key] = value.strip()
        else:
            processed_data[key] = value

    processed_data['processed_at'] = datetime.now().isoformat()

    processed_data['is_validated'] = True

    return processed_data
