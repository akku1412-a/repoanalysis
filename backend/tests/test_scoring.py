from app.main import _repo_parts


def test_repository_url_validation():
    assert _repo_parts("https://github.com/example/project")[1] == "project"


def test_repository_url_rejects_non_github():
    try:
        _repo_parts("https://example.com/project")
    except ValueError:
        pass
    else:
        raise AssertionError("non-GitHub URL should be rejected")
