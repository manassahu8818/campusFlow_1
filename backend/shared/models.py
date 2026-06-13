"""
Data models for CampusFlow extracted data.

These mirror the strict JSON schema that Claude/Textract output is parsed into.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional, List


@dataclass
class ConfidenceField:
    """A field with an associated confidence score."""
    value: Optional[str] = None
    confidence: float = 0.0


@dataclass
class ClassEntry:
    """A single class in a timetable."""
    day: str = ""
    time: str = ""
    subject: str = ""
    location: Optional[str] = None
    professor: Optional[str] = None
    confidence: float = 0.9

    @property
    def sk(self) -> str:
        return f"CLASS#{self.day.lower()}-{self.time.replace(':', '')}"

    def to_dynamo(self) -> dict:
        d = asdict(self)
        d["SK"] = self.sk
        d["type"] = "CLASS"
        return d


@dataclass
class Deadline:
    """An assignment or exam deadline."""
    id: str = ""
    title: str = ""
    subject: str = ""
    due_date: str = ""  # ISO format
    description: Optional[str] = None
    confidence: float = 0.9

    @property
    def sk(self) -> str:
        return f"DEADLINE#{self.id}"

    def to_dynamo(self) -> dict:
        d = asdict(self)
        d["SK"] = self.sk
        d["type"] = "DEADLINE"
        return d


@dataclass
class Notice:
    """A campus notice or announcement."""
    id: str = ""
    title: str = ""
    body: str = ""
    date: Optional[str] = None
    category: str = "general"  # hostel, academic, placement, event
    confidence: float = 0.9

    @property
    def sk(self) -> str:
        return f"NOTICE#{self.id}"

    def to_dynamo(self) -> dict:
        d = asdict(self)
        d["SK"] = self.sk
        d["type"] = "NOTICE"
        return d


@dataclass
class MenuItem:
    """A mess/canteen menu item."""
    meal: str = ""  # breakfast, lunch, dinner
    day: str = ""
    items: list[str] = field(default_factory=list)
    confidence: float = 0.9

    @property
    def sk(self) -> str:
        return f"MENU#{self.day.lower()}-{self.meal.lower()}"

    def to_dynamo(self) -> dict:
        d = asdict(self)
        d["SK"] = self.sk
        d["type"] = "MENU"
        return d


@dataclass
class ExtractionResult:
    """Full extraction result from a document."""
    document_type: str = "unknown"  # timetable, notice, menu, deadline, mixed
    classes: list[ClassEntry] = field(default_factory=list)
    deadlines: list[Deadline] = field(default_factory=list)
    notices: list[Notice] = field(default_factory=list)
    menu_items: list[MenuItem] = field(default_factory=list)
    raw_text: str = ""
    overall_confidence: float = 0.0
    source_file: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    def all_dynamo_items(self) -> list[dict]:
        """Get all items ready for DynamoDB batch write."""
        items = []
        for c in self.classes:
            items.append(c.to_dynamo())
        for d in self.deadlines:
            items.append(d.to_dynamo())
        for n in self.notices:
            items.append(n.to_dynamo())
        for m in self.menu_items:
            items.append(m.to_dynamo())
        return items
