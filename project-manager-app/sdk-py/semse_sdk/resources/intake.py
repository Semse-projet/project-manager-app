"""Smart-intake resource for satellites (scope `intake:write` / `intake:read`).

First consumer: SAT-002 Alexa. The channel is marked with `x-semse-channel`,
mirroring packages/sdk/src/resources/intake.ts exactly.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from ..client import SemseClient


def _channel_header(channel: Optional[str]) -> Optional[Dict[str, str]]:
    return {"x-semse-channel": channel} if channel else None


class IntakeResource:
    def __init__(self, client: "SemseClient") -> None:
        self._client = client

    def analyze(
        self,
        raw_description: str,
        intake_id: Optional[str] = None,
        title: Optional[str] = None,
        category: Optional[str] = None,
        subcategory: Optional[str] = None,
        modality: Optional[str] = None,
        city: Optional[str] = None,
        urgency: Optional[str] = None,
        channel: Optional[str] = None,
    ) -> Any:
        payload: Dict[str, Any] = {"rawDescription": raw_description}
        for key, value in (
            ("intakeId", intake_id),
            ("title", title),
            ("category", category),
            ("subcategory", subcategory),
            ("modality", modality),
            ("city", city),
            ("urgency", urgency),
        ):
            if value is not None:
                payload[key] = value
        return self._client.post("/v1/intake/analyze", payload, _channel_header(channel))

    def answer(
        self,
        intake_id: str,
        question_id: str,
        selected_values: Optional[List[str]] = None,
        custom_text: Optional[str] = None,
        is_not_sure: Optional[bool] = None,
        channel: Optional[str] = None,
    ) -> Any:
        payload: Dict[str, Any] = {"questionId": question_id}
        if selected_values is not None:
            payload["selectedValues"] = selected_values
        if custom_text is not None:
            payload["customText"] = custom_text
        if is_not_sure is not None:
            payload["isNotSure"] = is_not_sure
        return self._client.patch(f"/v1/intake/{intake_id}/answer", payload, _channel_header(channel))

    def get(self, intake_id: str) -> Any:
        return self._client.get(f"/v1/intake/{intake_id}")
