#pragma once
/**
 * Bantu Language - Function Object
 */

#include "types.hpp"
#include "ast.hpp"
#include "environment.hpp"
#include <vector>
#include <string>

class BantuFunction {
public:
    std::string name;
    std::vector<std::string> params;
    std::vector<std::shared_ptr<ASTNode>> body;
    std::shared_ptr<Environment> closure;

    BantuFunction(const std::string& n, std::vector<std::string> p,
                  std::vector<std::shared_ptr<ASTNode>> b,
                  std::shared_ptr<Environment> env)
        : name(n), params(std::move(p)), body(std::move(b)), closure(std::move(env)) {}

    size_t arity() const { return params.size(); }
};
