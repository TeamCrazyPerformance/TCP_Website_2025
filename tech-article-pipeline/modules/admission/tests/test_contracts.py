from __future__ import annotations

from tech_article_admission.contracts import ContractValidator
from tech_article_admission.errors import AdmissionError


def test_mysql_bound_string_limits_are_rejected(payload_factory) -> None:
    payload = payload_factory()
    payload["crawlItemId"] = "x" * 161

    try:
        ContractValidator().validate_admission(payload)
    except AdmissionError as error:
        assert error.code == "INVALID_INPUT"
    else:
        raise AssertionError("Expected the MySQL-bound identifier limit to fail.")


def test_url_port_zero_and_failed_normalization_are_rejected(payload_factory) -> None:
    validator = ContractValidator()
    payload = payload_factory(canonical_url="https://example.com:0/article")
    try:
        validator.validate_admission(payload)
    except AdmissionError as error:
        assert error.code == "INVALID_INPUT"
    else:
        raise AssertionError("Expected an invalid URL port to fail.")

    payload = payload_factory()
    payload["normalization"]["status"] = "FAILED"
    payload["normalization"]["error"] = {"code": "NORMALIZATION_FAILED"}
    try:
        validator.validate_admission(payload)
    except AdmissionError as error:
        assert error.code == "INVALID_INPUT"
    else:
        raise AssertionError("Expected a failed normalization payload to fail.")


def test_unknown_upstream_fields_are_preserved_in_digest(payload_factory) -> None:
    validator = ContractValidator()
    payload = payload_factory()
    payload["upstreamExtension"] = {"trace": "trace-1"}

    validated = validator.validate_admission(payload)

    assert validated["upstreamExtension"] == {"trace": "trace-1"}


def test_unsupported_policy_has_a_stable_error_code(payload_factory) -> None:
    payload = payload_factory()
    payload["duplicatePolicy"]["policyVersion"] = "duplicate-policy-v999"

    try:
        ContractValidator().validate_admission(payload)
    except AdmissionError as error:
        assert error.code == "POLICY_VERSION_UNSUPPORTED"
    else:
        raise AssertionError("Expected an unsupported policy to fail.")
