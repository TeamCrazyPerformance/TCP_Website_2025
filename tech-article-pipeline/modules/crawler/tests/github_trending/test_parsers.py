import pytest
from github_trending_pipeline.errors import GitHubTrendingError
from github_trending_pipeline.parsers import parse_trending_repositories


def test_parser_preserves_dom_rank_and_metadata(trending_html):
    repositories = parse_trending_repositories(trending_html)

    assert [repository.full_name for repository in repositories] == [
        "alpha/first",
        "bravo/second",
        "charlie/third",
        "delta/fourth",
    ]
    assert repositories[0].rank == 1
    assert repositories[0].programming_language == "Python"
    assert repositories[0].total_stars == 12_345
    assert repositories[0].total_forks == 1_234
    assert repositories[0].stars_today == 987
    assert repositories[0].built_by == ["alice"]


def test_parser_fails_closed_when_card_structure_changes():
    with pytest.raises(GitHubTrendingError) as raised:
        parse_trending_repositories('<article class="Box-row"><p>missing link</p></article>')
    assert raised.value.code == "TRENDING_STRUCTURE_CHANGED"
